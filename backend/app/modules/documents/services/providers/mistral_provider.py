"""Mistral provider para extracao de documentos via OCR especializado"""
import asyncio
import io
import json
from pathlib import Path

from app.core.config import settings
from .base import BaseProvider
from ..document_classifier import DocumentClassifier, DocumentType


DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 2.0
# Tamanho maximo para imagens antes de comprimir (2MB)
MAX_IMAGE_SIZE_MB = 2.0

# Singleton Mistral client para reutilização
_mistral_client = None
_mistral_client_lock = asyncio.Lock()


async def get_mistral_client():
    """
    Retorna um cliente Mistral singleton.
    Evita criar novo cliente a cada requisicao.
    """
    global _mistral_client

    if _mistral_client is not None:
        return _mistral_client

    async with _mistral_client_lock:
        # Double-check pattern
        if _mistral_client is not None:
            return _mistral_client

        api_key = settings.mistral_api_key
        if not api_key:
            raise ValueError("MISTRAL_API_KEY nao configurada")

        try:
            from mistralai import Mistral

            # Cliente singleton - a biblioteca Mistral gerencia conexoes internamente
            _mistral_client = Mistral(api_key=api_key)
            print("[MistralProvider] Cliente Mistral singleton inicializado")
            return _mistral_client

        except ImportError:
            raise ImportError("mistralai nao instalado. Execute: pip install mistralai")


def compress_image_sync(image_bytes: bytes, max_size_mb: float = MAX_IMAGE_SIZE_MB) -> bytes:
    """
    Comprime imagem se exceder tamanho maximo.
    Mantém qualidade aceitavel para OCR.
    Otimizado para memoria: reutiliza buffer e fecha imagens explicitamente.
    """
    import gc

    max_size = int(max_size_mb * 1024 * 1024)
    if len(image_bytes) <= max_size:
        return image_bytes

    img = None
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes))

        # Converter para RGB se necessario
        if img.mode in ('RGBA', 'P'):
            old_img = img
            img = img.convert('RGB')
            old_img.close()

        # Usar um unico buffer reutilizado
        buffer = io.BytesIO()

        # Tentar comprimir reduzindo qualidade
        for quality in range(85, 25, -10):
            buffer.seek(0)
            buffer.truncate()
            img.save(buffer, format='JPEG', quality=quality, optimize=True)
            if buffer.tell() <= max_size:
                result = buffer.getvalue()
                print(f"[MistralProvider] Imagem comprimida: {len(image_bytes)} -> {len(result)} bytes (quality={quality})")
                return result

        # Se ainda muito grande, redimensionar
        width, height = img.size
        for scale in [0.8, 0.7, 0.6, 0.5, 0.4, 0.3]:
            new_size = (int(width * scale), int(height * scale))
            resized = img.resize(new_size, Image.Resampling.LANCZOS)
            buffer.seek(0)
            buffer.truncate()
            resized.save(buffer, format='JPEG', quality=70, optimize=True)
            resized.close()  # Fechar imagem redimensionada imediatamente
            if buffer.tell() <= max_size:
                result = buffer.getvalue()
                print(f"[MistralProvider] Imagem redimensionada e comprimida: {len(image_bytes)} -> {len(result)} bytes (scale={scale})")
                return result

        # Retornar ultima tentativa mesmo se ainda grande
        result = buffer.getvalue()
        print(f"[MistralProvider] AVISO: Imagem ainda grande apos compressao: {len(result)} bytes")
        return result

    except Exception as e:
        print(f"[MistralProvider] Erro ao comprimir imagem: {e}")
        return image_bytes

    finally:
        # Fechar imagem e forcar GC
        if img is not None:
            try:
                img.close()
            except Exception:
                pass
        gc.collect()


class MistralProvider(BaseProvider):
    """Provider Mistral para extracao via OCR especializado + LLM"""

    def __init__(self, model: str | None = None, prompt: str = "", parse_response_fn=None, use_classifier: bool = True):
        super().__init__(model or settings.mistral_llm_model)
        self.max_retries = DEFAULT_MAX_RETRIES
        self.retry_delay = DEFAULT_RETRY_DELAY
        self.prompt = prompt
        self._parse_response = parse_response_fn or (lambda x: {'items': [], 'error': 'No parser'})
        self.classifier = DocumentClassifier() if use_classifier else None
        print(f"[MistralProvider] Initialized with classifier={use_classifier}")

    def _upload_sync(self, client, pdf_content: bytes, filename: str):
        """Upload sincrono do PDF para Mistral"""
        return client.files.upload(
            file={
                "file_name": filename,
                "content": pdf_content,
            },
            purpose="ocr"
        )

    def _ocr_sync(self, client, file_id: str):
        """OCR sincrono do PDF"""
        return client.ocr.process(
            model=settings.mistral_ocr_model,
            document={
                "type": "file",
                "file_id": file_id,
            },
            include_image_base64=False
        )

    def _chat_sync(self, client, full_prompt: str):
        """Chat sincrono com LLM"""
        return client.chat.complete(
            model=settings.mistral_llm_model,
            messages=[
                {
                    "role": "user",
                    "content": full_prompt
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=32000  # Aumentado para cupons grandes com muitos itens
        )

    async def _get_prompt(self, ocr_text: str = "") -> tuple[str, str]:
        """Carrega o prompt apropriado baseado no tipo de documento detectado.

        Returns:
            tuple[str, str]: (prompt_text, document_type)
        """
        prompts_dir = Path(__file__).parent.parent.parent / "prompts"

        # Usar novo classificador se disponivel
        if self.classifier:
            print(f"[MistralProvider] Usando DocumentClassifier...")
            doc_type_enum = await self.classifier.classify(ocr_text, max_chars=3000)

            if doc_type_enum == DocumentType.CUPOM_FISCAL:
                doc_type = "cupom_fiscal"
                prompt_path = prompts_dir / "cupom_fiscal_focused.md"
                print(f"[MistralProvider] Tipo detectado: CUPOM_FISCAL -> usando prompt focado")
            elif doc_type_enum == DocumentType.FATURA_CARTAO:
                doc_type = "fatura_cartao"
                prompt_path = prompts_dir / "fatura_cartao_focused.md"
                print(f"[MistralProvider] Tipo detectado: FATURA_CARTAO -> usando prompt focado")
            else:
                # Fallback: usar metodo antigo
                print(f"[MistralProvider] Tipo UNKNOWN, usando deteccao antiga...")
                doc_type = self._detect_document_type(ocr_text)
                if doc_type == "cupom_fiscal":
                    prompt_path = prompts_dir / "cupom_fiscal_focused.md"
                else:
                    prompt_path = prompts_dir / "fatura_cartao_focused.md"
        else:
            # Fallback: usar metodo antigo
            doc_type = self._detect_document_type(ocr_text)
            print(f"[MistralProvider] Tipo detectado (metodo antigo): {doc_type}")

            if doc_type == "cupom_fiscal":
                prompt_path = prompts_dir / "cupom_fiscal_focused.md"
            else:
                prompt_path = prompts_dir / "fatura_cartao_focused.md"

        # Carregar prompt
        if prompt_path.exists():
            prompt_text = prompt_path.read_text(encoding="utf-8")
            print(f"[MistralProvider] Prompt carregado: {prompt_path.name}")
            return prompt_text, doc_type

        # Fallback final: prompt generico
        print(f"[MistralProvider] AVISO: Prompt {prompt_path} nao encontrado, usando self.prompt")
        return self.prompt, doc_type

    def _detect_document_type(self, ocr_text: str) -> str:
        """Detecta se é cupom fiscal ou fatura de cartão."""
        text_lower = ocr_text.lower()

        # Indicadores de cupom fiscal / NFC-e
        cupom_indicators = [
            "cupom fiscal",
            "nfc-e",
            "nota fiscal",
            "danfe",
            "cnpj",
            "item codigo descricao",
            "qtde un vl unit",
            "valor total r$",
            "forma de pagamento",
            "troco",
            "chave de acesso",
            "protocolo de autorizacao",
            "qr code",
            "consumidor final",
        ]

        # Indicadores de fatura de cartão
        fatura_indicators = [
            "fatura",
            "vencimento",
            "limite de credito",
            "limite disponivel",
            "pagamento minimo",
            "encargos",
            "parcelamento",
            "total a pagar",
            "cartao final",
            "nubank",
            "itau",
            "bradesco",
            "santander",
            "banco",
        ]

        cupom_score = sum(1 for indicator in cupom_indicators if indicator in text_lower)
        fatura_score = sum(1 for indicator in fatura_indicators if indicator in text_lower)

        print(f"[MistralProvider] Score cupom: {cupom_score}, Score fatura: {fatura_score}")

        return "cupom_fiscal" if cupom_score > fatura_score else "fatura_cartao"

    async def extract_from_image(self, image_content: bytes, mime_type: str) -> dict:
        """Converte imagem para PDF e processa via OCR"""
        # Converter imagem para PDF
        pdf_content = await self._image_to_pdf(image_content, mime_type)
        return await self.extract_from_pdf(pdf_content, "image.pdf")

    async def extract_multi_page(self, images: list[tuple[bytes, str]]) -> dict:
        """Converte multiplas imagens para PDF e processa via OCR"""
        print(f"[MistralProvider] Convertendo {len(images)} imagens para PDF...")
        pdf_content = await self._images_to_pdf(images)
        print(f"[MistralProvider] PDF gerado: {len(pdf_content)} bytes")
        return await self.extract_from_pdf(pdf_content, "multi_page.pdf")

    async def _image_to_pdf(self, image_content: bytes, mime_type: str) -> bytes:
        """Converte uma imagem para PDF"""
        return await self._images_to_pdf([(image_content, mime_type)])

    async def _images_to_pdf(self, images: list[tuple[bytes, str]]) -> bytes:
        """
        Converte multiplas imagens para um unico PDF, dividindo páginas muito longas.
        Otimizado para memoria: fecha imagens explicitamente e roda gc.collect() periodicamente.
        """
        import gc
        from PIL import Image

        def _split_long_image(img: Image.Image, max_ratio: float = 3.0) -> tuple[list[Image.Image], bool]:
            """
            Divide uma imagem muito longa em seções verticais menores.
            Retorna (sections, was_split) para saber se deve fechar a imagem original.
            """
            width, height = img.size
            ratio = height / width

            if ratio <= max_ratio:
                return [img], False

            # Calcular quantas seções precisamos
            num_sections = int(ratio / max_ratio) + 1
            section_height = height // num_sections

            # Overlap de 10% da altura da seção para não cortar texto
            overlap = max(100, int(section_height * 0.10))
            sections = []

            for i in range(num_sections):
                top = max(0, i * section_height - (overlap if i > 0 else 0))
                bottom = min(height, (i + 1) * section_height + (overlap if i < num_sections - 1 else 0))

                section = img.crop((0, top, width, bottom))
                sections.append(section)

            print(f"[MistralProvider] Imagem longa detectada (ratio={ratio:.1f}), dividida em {len(sections)} seções")
            return sections, True

        def _convert():
            pdf_images = []

            for idx, (img_content, _) in enumerate(images):
                img = None
                try:
                    # Comprimir imagem antes de converter para PDF
                    img_content = compress_image_sync(img_content)

                    img = Image.open(io.BytesIO(img_content))
                    if img.mode in ('RGBA', 'P'):
                        old_img = img
                        img = img.convert('RGB')
                        old_img.close()

                    # Dividir se for muito longa
                    sections, was_split = _split_long_image(img)
                    pdf_images.extend(sections)

                    # Se foi dividido, fechar a imagem original (as sections sao novas)
                    if was_split:
                        img.close()
                        img = None  # Evitar fechar novamente no finally

                finally:
                    # Liberar referencia dos bytes da imagem
                    del img_content

                # GC a cada 3 imagens para evitar pico de memoria
                if (idx + 1) % 3 == 0:
                    gc.collect()

            # Criar PDF
            output = io.BytesIO()
            try:
                if len(pdf_images) == 1:
                    pdf_images[0].save(output, format='PDF')
                else:
                    pdf_images[0].save(output, format='PDF', save_all=True, append_images=pdf_images[1:])
                result = output.getvalue()
            finally:
                # Fechar todas as imagens do PDF
                for img in pdf_images:
                    try:
                        img.close()
                    except Exception:
                        pass
                pdf_images.clear()
                gc.collect()

            return result

        return await asyncio.to_thread(_convert)

    async def _split_long_pdf(self, pdf_content: bytes, max_ratio: float = 3.0) -> bytes:
        """
        Detecta e divide PDFs com páginas muito longas.
        Otimizado para memoria: processa pagina por pagina e libera recursos imediatamente.
        """
        import gc
        import io
        from PIL import Image

        try:
            import fitz  # PyMuPDF
        except ImportError:
            print("[MistralProvider] PyMuPDF não instalado, não é possível dividir PDF longo")
            return pdf_content

        def _process():
            doc = fitz.open(stream=pdf_content, filetype="pdf")

            # Primeira passagem: apenas verificar se precisa dividir (sem armazenar imagens)
            needs_split = False
            for page_num in range(len(doc)):
                page = doc[page_num]
                rect = page.rect
                ratio = rect.height / rect.width
                if ratio > max_ratio:
                    needs_split = True
                    break

            if not needs_split:
                doc.close()
                return pdf_content

            print(f"[MistralProvider] PDF com página longa detectado, processando {len(doc)} página(s)...")

            # Segunda passagem: processar pagina por pagina
            final_images = []

            try:
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    mat = fitz.Matrix(2, 2)  # 2x zoom para melhor qualidade
                    pix = page.get_pixmap(matrix=mat)

                    # Converter para PIL Image
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

                    # Liberar pixmap imediatamente
                    del pix

                    width, height = img.size
                    ratio = height / width

                    if ratio <= max_ratio:
                        final_images.append(img)
                    else:
                        # Dividir a imagem
                        num_sections = int(ratio / max_ratio) + 1
                        section_height = height // num_sections
                        overlap = max(100, int(section_height * 0.10))

                        for i in range(num_sections):
                            top = max(0, i * section_height - (overlap if i > 0 else 0))
                            bottom = min(height, (i + 1) * section_height + (overlap if i < num_sections - 1 else 0))
                            section = img.crop((0, top, width, bottom))
                            final_images.append(section)

                        # Fechar imagem original apos dividir (as sections sao novas)
                        img.close()
                        print(f"[MistralProvider] Página {page_num + 1} dividida em {num_sections} seções")

                    # GC periodico
                    if (page_num + 1) % 3 == 0:
                        gc.collect()

                doc.close()

                # Reconverter para PDF
                output = io.BytesIO()
                if len(final_images) == 1:
                    final_images[0].save(output, format='PDF')
                else:
                    final_images[0].save(output, format='PDF', save_all=True, append_images=final_images[1:])

                result = output.getvalue()
                print(f"[MistralProvider] PDF recriado com {len(final_images)} páginas")
                return result

            finally:
                # Cleanup: fechar todas as imagens
                for img in final_images:
                    try:
                        img.close()
                    except Exception:
                        pass
                final_images.clear()
                gc.collect()

        return await asyncio.to_thread(_process)

    async def extract_from_pdf(self, pdf_content: bytes, filename: str = "document.pdf") -> dict:
        """
        Extrai dados de um PDF usando Mistral OCR + LLM (processo em 2 etapas).

        Processo:
        1. Upload do PDF para Mistral (via thread)
        2. Mistral OCR extrai texto/tabelas em markdown (via thread)
        3. Mistral LLM estrutura os dados em JSON (via thread)
        """
        # Pré-processar PDF para dividir páginas muito longas
        pdf_content = await self._split_long_pdf(pdf_content)

        try:
            # Usar cliente singleton com connection pooling
            client = await get_mistral_client()
        except ValueError as e:
            return {
                'items': [],
                'card_info': None,
                'document_type': None,
                'error': str(e)
            }
        except ImportError as e:
            return {
                'items': [],
                'card_info': None,
                'document_type': None,
                'error': str(e)
            }

        try:
            # Passo 1: Upload do PDF (em thread separada)
            print(f"[MistralProvider] Passo 1: Fazendo upload do PDF ({len(pdf_content)} bytes)...")
            uploaded_file = await asyncio.to_thread(
                self._upload_sync, client, pdf_content, filename
            )
            print(f"[MistralProvider] Upload concluido: {uploaded_file.id}")

            # Passo 2: OCR do PDF (em thread separada)
            print(f"[MistralProvider] Passo 2: Executando OCR com modelo {settings.mistral_ocr_model}...")
            ocr_response = await asyncio.to_thread(
                self._ocr_sync, client, uploaded_file.id
            )

            # Extrair texto do OCR
            ocr_text = ""
            if hasattr(ocr_response, 'pages'):
                for page in ocr_response.pages:
                    if hasattr(page, 'markdown'):
                        ocr_text += page.markdown + "\n\n"
            elif hasattr(ocr_response, 'text'):
                ocr_text = ocr_response.text
            else:
                ocr_dict = ocr_response.model_dump() if hasattr(ocr_response, 'model_dump') else dict(ocr_response)
                ocr_text = json.dumps(ocr_dict, indent=2)

            print(f"[MistralProvider] OCR extraiu {len(ocr_text)} caracteres")
            # Log do texto para debug
            print(f"[MistralProvider] OCR texto preview: {ocr_text[:500]}")

            if not ocr_text.strip():
                return {
                    'items': [],
                    'card_info': None,
                    'document_type': None,
                    'error': 'OCR nao extraiu texto do PDF'
                }

            # Passo 3: Estruturar com LLM (em thread separada com retry)
            print(f"[MistralProvider] Passo 3: Estruturando com LLM {settings.mistral_llm_model}...")

            prompt, detected_doc_type = await self._get_prompt(ocr_text)
            full_prompt = f"{prompt}\n\n## Texto extraido do PDF pelo OCR:\n\n{ocr_text}"

            print(f"[MistralProvider] Tipo final detectado: {detected_doc_type}")

            last_error = None
            for attempt in range(self.max_retries):
                try:
                    chat_response = await asyncio.to_thread(
                        self._chat_sync, client, full_prompt
                    )

                    response_text = chat_response.choices[0].message.content
                    print(f"[MistralProvider] LLM retornou {len(response_text)} caracteres")

                    result = self._parse_response(response_text)

                    if result.get('items'):
                        result['_ocr_text_preview'] = ocr_text[:500] + "..." if len(ocr_text) > 500 else ocr_text

                    return result

                except Exception as e:
                    last_error = e
                    if self._is_retryable_error(e) and attempt < self.max_retries - 1:
                        wait_time = self.retry_delay * (2 ** attempt)
                        print(f"[MistralProvider] Erro retryable, aguardando {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        raise

            return {'items': [], 'error': f'Falha apos {self.max_retries} tentativas: {last_error}'}

        except Exception as e:
            print(f"[MistralProvider] Erro: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                'items': [],
                'card_info': None,
                'document_type': None,
                'error': f'Mistral error: {str(e)}'
            }
