"""Mistral provider para extracao de documentos via OCR especializado"""
import asyncio
import json
from pathlib import Path

from app.core.config import settings
from .base import BaseProvider


DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 2.0


class MistralProvider(BaseProvider):
    """Provider Mistral para extracao via OCR especializado + LLM"""

    def __init__(self, model: str | None = None, prompt: str = "", parse_response_fn=None):
        super().__init__(model or settings.mistral_llm_model)
        self.max_retries = DEFAULT_MAX_RETRIES
        self.retry_delay = DEFAULT_RETRY_DELAY
        self.prompt = prompt
        self._parse_response = parse_response_fn or (lambda x: {'items': [], 'error': 'No parser'})

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

    def _get_prompt(self, ocr_text: str = "") -> str:
        """Carrega o prompt apropriado baseado no tipo de documento detectado."""
        prompts_dir = Path(__file__).parent.parent.parent / "prompts"

        # Detectar tipo de documento pelo texto OCR
        doc_type = self._detect_document_type(ocr_text)
        print(f"[MistralProvider] Tipo de documento detectado: {doc_type}")

        if doc_type == "cupom_fiscal":
            prompt_path = prompts_dir / "prompt_cupom_fiscal.md"
        else:
            prompt_path = prompts_dir / "prompt_mistral.md"

        if prompt_path.exists():
            return prompt_path.read_text(encoding="utf-8")
        return self.prompt

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
        """Converte multiplas imagens para um unico PDF, dividindo páginas muito longas"""
        import io
        from PIL import Image

        def _split_long_image(img: Image.Image, max_ratio: float = 3.0) -> list[Image.Image]:
            """Divide uma imagem muito longa em seções verticais menores"""
            width, height = img.size
            ratio = height / width

            if ratio <= max_ratio:
                return [img]

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
            return sections

        def _convert():
            pdf_images = []
            for img_content, _ in images:
                img = Image.open(io.BytesIO(img_content))
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')

                # Dividir se for muito longa
                sections = _split_long_image(img)
                pdf_images.extend(sections)

            output = io.BytesIO()
            if len(pdf_images) == 1:
                pdf_images[0].save(output, format='PDF')
            else:
                pdf_images[0].save(output, format='PDF', save_all=True, append_images=pdf_images[1:])
            return output.getvalue()

        return await asyncio.to_thread(_convert)

    async def _split_long_pdf(self, pdf_content: bytes, max_ratio: float = 3.0) -> bytes:
        """Detecta e divide PDFs com páginas muito longas"""
        import io
        from PIL import Image

        try:
            import fitz  # PyMuPDF
        except ImportError:
            print("[MistralProvider] PyMuPDF não instalado, não é possível dividir PDF longo")
            return pdf_content

        def _process():
            doc = fitz.open(stream=pdf_content, filetype="pdf")
            needs_split = False
            all_images = []

            for page_num in range(len(doc)):
                page = doc[page_num]
                # Renderizar página como imagem
                mat = fitz.Matrix(2, 2)  # 2x zoom para melhor qualidade
                pix = page.get_pixmap(matrix=mat)

                # Verificar proporção
                ratio = pix.height / pix.width
                if ratio > max_ratio:
                    needs_split = True

                # Converter para PIL Image
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                all_images.append(img)

            doc.close()

            if not needs_split:
                return pdf_content

            print(f"[MistralProvider] PDF com página longa detectado, processando {len(all_images)} página(s)...")

            # Dividir imagens longas
            final_images = []
            for img in all_images:
                width, height = img.size
                ratio = height / width

                if ratio <= max_ratio:
                    final_images.append(img)
                else:
                    # Dividir a imagem
                    num_sections = int(ratio / max_ratio) + 1
                    section_height = height // num_sections
                    # Overlap de 10% da altura da seção para não cortar texto
                    overlap = max(100, int(section_height * 0.10))

                    for i in range(num_sections):
                        top = max(0, i * section_height - (overlap if i > 0 else 0))
                        bottom = min(height, (i + 1) * section_height + (overlap if i < num_sections - 1 else 0))
                        section = img.crop((0, top, width, bottom))
                        final_images.append(section)

                    print(f"[MistralProvider] Página dividida em {num_sections} seções")

            # Reconverter para PDF
            output = io.BytesIO()
            if len(final_images) == 1:
                final_images[0].save(output, format='PDF')
            else:
                final_images[0].save(output, format='PDF', save_all=True, append_images=final_images[1:])

            print(f"[MistralProvider] PDF recriado com {len(final_images)} páginas")
            return output.getvalue()

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

        api_key = settings.mistral_api_key
        if not api_key:
            return {
                'items': [],
                'card_info': None,
                'document_type': None,
                'error': 'MISTRAL_API_KEY nao configurada'
            }

        try:
            from mistralai import Mistral
        except ImportError:
            return {
                'items': [],
                'card_info': None,
                'document_type': None,
                'error': 'mistralai nao instalado. Execute: pip install mistralai'
            }

        try:
            client = Mistral(api_key=api_key)

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

            prompt = self._get_prompt(ocr_text)
            full_prompt = f"{prompt}\n\n## Texto extraido do PDF pelo OCR:\n\n{ocr_text}"

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
