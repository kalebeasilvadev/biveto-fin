"""Servico de extracao de dados usando LLM com visao (multi-provider)

Este modulo foi refatorado para seguir Clean Code:
- Providers separados em providers/
- Validacao em extraction_validator.py
- Parser em response_parser.py
- Conversao PDF em pdf_converter.py
"""
from app.core.config import settings

from .schemas import FaturaExtracao
from .prompts import EXTRACTION_PROMPT
from .pdf_converter import convert_pdf_to_images
from .response_parser import ResponseParser
from .extraction_validator import ExtractionValidator
from .providers import GoogleProvider, MistralProvider, OpenAIProvider, AnthropicProvider


class LLMOCRService:
    """Extrai dados de imagens usando LLM com visao (suporta multiplos providers)"""

    def __init__(self, provider: str | None = None, model: str | None = None):
        self.provider_name = provider or settings.vision_provider
        self.model = model or settings.vision_model or 'gemini-2.0-flash'
        self.parser = ResponseParser()
        self.validator = ExtractionValidator()
        self._provider = None
        print(f"[LLM_OCR] Initialized: provider={self.provider_name}, model={self.model}")

    def _get_provider(self):
        """Retorna o provider configurado (lazy initialization)"""
        if self._provider is None:
            parse_fn = self.parser.parse

            if self.provider_name == 'google':
                self._provider = GoogleProvider(
                    model=self.model,
                    prompt=EXTRACTION_PROMPT,
                    response_schema=FaturaExtracao,
                    parse_response_fn=parse_fn
                )
            elif self.provider_name == 'mistral':
                self._provider = MistralProvider(
                    model=self.model,
                    prompt=EXTRACTION_PROMPT,
                    parse_response_fn=parse_fn
                )
            elif self.provider_name == 'openai':
                self._provider = OpenAIProvider(
                    model=self.model,
                    prompt=EXTRACTION_PROMPT,
                    parse_response_fn=parse_fn
                )
            elif self.provider_name == 'anthropic':
                self._provider = AnthropicProvider(
                    model=self.model,
                    prompt=EXTRACTION_PROMPT,
                    parse_response_fn=parse_fn
                )
            else:
                raise ValueError(f"Provider nao suportado: {self.provider_name}")

        return self._provider

    async def extract_from_image(
        self,
        image_content: bytes,
        mime_type: str = 'image/png',
        filename: str = "document"
    ) -> dict:
        """Extrai dados do documento usando o provider configurado

        Args:
            image_content: Conteudo binario do arquivo
            mime_type: Tipo MIME (image/png, application/pdf, etc.)
            filename: Nome do arquivo original

        Returns:
            Dict com items, card_info, document_type ou error
        """
        print(f"[LLM_OCR] extract_from_image: provider={self.provider_name}, mime_type={mime_type}, size={len(image_content)}")

        try:
            is_pdf = mime_type == 'application/pdf' or mime_type.endswith('/pdf')
            provider = self._get_provider()

            # 1. Tentar processar diretamente (PDF ou imagem)
            if is_pdf:
                print(f"[LLM_OCR] Processing PDF via {self.provider_name}")
                result = await provider.extract_from_pdf(image_content, filename)

                # Se provider retornou None, precisa converter para imagens
                if result is None:
                    print(f"[LLM_OCR] Provider nao suporta PDF direto, convertendo para imagens...")
                    result = await self._process_pdf_as_images(image_content)
            else:
                result = await provider.extract_from_image(image_content, mime_type)

            # 2. Se nao conseguiu extrair, retorna erro
            if not result or result.get('error'):
                return result or {'items': [], 'error': 'Extracao falhou'}

            # 3. Aplicar validacoes e limpezas
            items = result.get('items', [])
            card_info = result.get('card_info')
            document_type = result.get('document_type')
            # Total pode vir no root ou dentro de card_info (cupom_fiscal)
            total_amount = result.get('total_amount') or (card_info.get('total_amount') if card_info else None)

            # DEBUG: Log para verificar total_amount
            print(f"[LLM_OCR] DEBUG: document_type={document_type}, total_amount={total_amount}")
            print(f"[LLM_OCR] DEBUG: result keys={list(result.keys())}")
            if 'total_amount' in result:
                print(f"[LLM_OCR] DEBUG: result['total_amount']={result.get('total_amount')}")

            if items:
                items = self.validator.validate_and_clean(items, card_info, document_type, total_amount)
                result['items'] = items

                # Validar resultado final
                validation = self.validator.validate_extraction(items, card_info)
                if not validation['is_valid']:
                    print(f"[LLM_OCR] AVISO: Validacao falhou - diff={validation['difference']:.2f}")

            return result

        except Exception as e:
            print(f"[LLM_OCR] Error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return {'items': [], 'error': str(e)}

    async def _process_pdf_as_images(self, pdf_content: bytes) -> dict:
        """Fallback: converte PDF para imagens e processa"""
        images, pdf_error = await convert_pdf_to_images(pdf_content)

        if pdf_error:
            return {'items': [], 'error': pdf_error}
        if not images:
            return {'items': [], 'error': 'PDF nao gerou imagens para processar'}

        provider = self._get_provider()

        # Se temos multiplas paginas e estamos usando Google, enviar todas juntas
        if len(images) > 1 and self.provider_name == 'google':
            return await provider.extract_multi_page(images)

        # Processar paginas separadamente
        all_items = []
        document_type = None
        card_info = None
        errors = []

        for page_num, (img_content, img_mime) in enumerate(images, 1):
            page_result = await provider.extract_from_image(img_content, img_mime)

            if page_result.get('error'):
                errors.append(f"Pagina {page_num}: {page_result['error']}")
            if page_result.get('items'):
                all_items.extend(page_result['items'])
            if page_result.get('document_type') and not document_type:
                document_type = page_result['document_type']
            if page_result.get('card_info') and not card_info:
                card_info = page_result['card_info']

        if not all_items and errors:
            return {'items': [], 'error': '; '.join(errors)}

        return {
            'items': all_items,
            'document_type': document_type,
            'card_info': card_info,
        }

    async def extract_from_multiple_images(
        self,
        images: list[tuple[bytes, str]],  # (content, mime_type)
    ) -> dict:
        """Extrai dados de multiplas imagens (cupons grandes)

        Args:
            images: Lista de tuples (content, mime_type)

        Returns:
            Dict com items, card_info, document_type ou error
        """
        print(f"[LLM_OCR] extract_from_multiple_images: provider={self.provider_name}, num_images={len(images)}")

        try:
            provider = self._get_provider()

            # Usar extract_multi_page (Google e Mistral suportam)
            if self.provider_name in ('google', 'mistral'):
                result = await provider.extract_multi_page(images)
            else:
                # Fallback: processar separadamente e consolidar
                all_items = []
                document_type = None
                card_info = None
                errors = []

                for page_num, (img_content, img_mime) in enumerate(images, 1):
                    page_result = await provider.extract_from_image(img_content, img_mime)

                    if page_result.get('error'):
                        errors.append(f"Imagem {page_num}: {page_result['error']}")
                    if page_result.get('items'):
                        all_items.extend(page_result['items'])
                    if page_result.get('document_type') and not document_type:
                        document_type = page_result['document_type']
                    if page_result.get('card_info') and not card_info:
                        card_info = page_result['card_info']

                if not all_items and errors:
                    return {'items': [], 'error': '; '.join(errors)}

                result = {
                    'items': all_items,
                    'document_type': document_type,
                    'card_info': card_info,
                }

            # Aplicar validacoes e limpezas
            if result and not result.get('error'):
                items = result.get('items', [])
                card_info = result.get('card_info')
                document_type = result.get('document_type')
                # Total pode vir no root ou dentro de card_info (cupom_fiscal)
                total_amount = result.get('total_amount') or (card_info.get('total_amount') if card_info else None)

                if items:
                    items = self.validator.validate_and_clean(items, card_info, document_type, total_amount)
                    result['items'] = items

                    validation = self.validator.validate_extraction(items, card_info)
                    if not validation['is_valid']:
                        print(f"[LLM_OCR] AVISO: Validacao falhou - diff={validation['difference']:.2f}")

            return result

        except Exception as e:
            print(f"[LLM_OCR] Error in extract_from_multiple_images: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return {'items': [], 'error': str(e)}
