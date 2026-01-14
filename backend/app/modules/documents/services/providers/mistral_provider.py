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
            temperature=0.0
        )

    def _get_prompt(self) -> str:
        """Carrega o prompt otimizado para Mistral OCR."""
        prompt_path = Path(__file__).parent.parent.parent / "prompts" / "prompt_mistral.md"
        if prompt_path.exists():
            return prompt_path.read_text(encoding="utf-8")
        return self.prompt

    async def extract_from_image(self, image_content: bytes, mime_type: str) -> dict:
        """Mistral nao suporta visao direta - use extract_from_pdf"""
        return {
            'items': [],
            'error': 'Mistral provider suporta apenas PDFs via OCR'
        }

    async def extract_from_pdf(self, pdf_content: bytes, filename: str = "document.pdf") -> dict:
        """
        Extrai dados de um PDF usando Mistral OCR + LLM (processo em 2 etapas).

        Processo:
        1. Upload do PDF para Mistral (via thread)
        2. Mistral OCR extrai texto/tabelas em markdown (via thread)
        3. Mistral LLM estrutura os dados em JSON (via thread)
        """
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

            if not ocr_text.strip():
                return {
                    'items': [],
                    'card_info': None,
                    'document_type': None,
                    'error': 'OCR nao extraiu texto do PDF'
                }

            # Passo 3: Estruturar com LLM (em thread separada com retry)
            print(f"[MistralProvider] Passo 3: Estruturando com LLM {settings.mistral_llm_model}...")

            prompt = self._get_prompt()
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
