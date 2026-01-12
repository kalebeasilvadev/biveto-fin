"""Serviço de extração de dados usando LLM com visão (multi-provider)

Melhorias implementadas:
- future_installments: Calcula parcelas futuras automaticamente
- Regra de consolidação Santander: Extrai UMA parcela por grupo
- Validação soma ≈ total_amount: Instruído no prompt
- API google-genai: SDK oficial com retry automático
- Retry com exponential backoff: Para erros 503/429
- Modelo gemini-2.5-flash-lite: Melhor custo/benefício
"""
import asyncio
import base64
import json
import time
from ..core.config import settings


EXTRACTION_PROMPT = """Você é o Agente Especialista de Extração Financeira (Brasil).
Sua missão é extrair com alta precisão itens/transações de documentos financeiros brasileiros (cupom fiscal, fatura de cartão, comprovante, extrato) e retornar APENAS um JSON válido.

========================
1) SCHEMA DE SAÍDA (JSON)
========================

{
  "items": [
    {
      "description": "Nome do produto ou estabelecimento",
      "amount": 123.45,
      "date": "2026-01-15",
      "category": "mercado",
      "installment_current": 3,
      "installment_total": 12,
      "is_installment": true,
      "future_installments": [
        {"installment": 4, "reference_month": 2, "reference_year": 2026},
        {"installment": 5, "reference_month": 3, "reference_year": 2026}
      ]
    }
  ],
  "document_type": "fatura_cartao",
  "card_info": {
    "card_issuer": "itau",
    "card_last_digits": "8849",
    "card_name": "Itaú Personnalité Visa Infinite",
    "invoice_month": 1,
    "invoice_year": 2026,
    "closing_date": "2026-01-08",
    "due_date": "2026-01-15",
    "total_amount": 3193.12
  }
}

========================
2) PRIORIDADE MÁXIMA: CARD_INFO
========================

Para faturas de cartão, SEMPRE extraia card_info:

1. **card_issuer** - Nome do banco/emissor em lowercase:
   - Exemplos: "itau", "inter", "bradesco", "nubank", "santander", "bb", "digio", "samsclub", "carrefour"

2. **card_last_digits** - Últimos 4 dígitos do cartão:
   - Padrões: "Final 8849", "**** 1234", "5364****7931"

3. **invoice_month/invoice_year** - Período da fatura:
   - Procure: "Vencimento", "Fatura de Janeiro/2026", "JAN/2026"

4. **due_date** - Data de vencimento (YYYY-MM-DD)

5. **closing_date** - Data de fechamento (YYYY-MM-DD)

6. **total_amount** - Valor total:
   - Procure: "Valor do Documento", "Total da Fatura", "Total a Pagar", "Saldo desta fatura"
   - NUNCA use "pagamento mínimo" ou "próxima fatura"

========================
3) REGRAS PARA FATURA DE CARTÃO
========================

3.1) SEÇÕES DA FATURA:

1️⃣ CABEÇALHO/RESUMO → Extrair card_info, NÃO extrair transações

2️⃣ LANÇAMENTOS/DESPESAS → EXTRAIR TODAS as transações:
   - "Lançamentos", "Despesas", "Compras e saques", "Detalhamento da Fatura"

3️⃣ PAGAMENTOS/CRÉDITOS → EXTRAIR como valores NEGATIVOS:
   - "PAGAMENTO", "CRÉDITO", "ESTORNO", "PAG FATURA"
   - category: "pagamento", "credito" ou "estorno"

4️⃣ PARCELAS FUTURAS → IGNORAR esta seção:
   - "Próximas faturas", "Saldos futuros", "Parcelados para próximas faturas"

3.2) PARCELAS E FUTURE_INSTALLMENTS (CRÍTICO):

Para cada item parcelado (is_installment = true), você DEVE calcular as parcelas futuras.

FÓRMULA:
- Parcela atual: installment_current (ex: 3)
- Total de parcelas: installment_total (ex: 12)
- Mês de referência: invoice_month/invoice_year (ex: Janeiro/2026)

Para cada parcela futura N (onde N > installment_current):
  meses_a_adicionar = N - installment_current
  reference_month = (invoice_month + meses_a_adicionar - 1) % 12 + 1
  reference_year = invoice_year + (invoice_month + meses_a_adicionar - 1) // 12

EXEMPLO:
- Item: "Steam" parcela 4/12
- Fatura: Janeiro/2026
- future_installments:
  - Parcela 5 → Fevereiro/2026 (reference_month: 2, reference_year: 2026)
  - Parcela 6 → Março/2026 (reference_month: 3, reference_year: 2026)
  - ... até parcela 12 → Setembro/2026 (reference_month: 9, reference_year: 2026)

VIRADA DE ANO:
- Item: "Loja X" parcela 10/12
- Fatura: Novembro/2025
- future_installments:
  - Parcela 11 → Dezembro/2025 (reference_month: 12, reference_year: 2025)
  - Parcela 12 → Janeiro/2026 (reference_month: 1, reference_year: 2026)

IMPORTANTE: O campo future_installments só existe se is_installment = true E installment_current < installment_total.

========================
4) REGRA ESPECIAL - SANTANDER (MUITO IMPORTANTE)
========================

A fatura Santander mostra TODAS as parcelas futuras no PDF (01/12, 02/12... 12/12).

REGRA CRÍTICA DE CONSOLIDAÇÃO:
- Quando o PDF mostrar múltiplas parcelas do MESMO estabelecimento:
  - EXTRAIR APENAS UMA como item principal (a PRIMEIRA parcela, geralmente 01/XX ou a menor)
  - As DEMAIS parcelas devem ir para o campo "future_installments"
  - NÃO extrair cada parcela como item separado!

EXEMPLO CORRETO (GOBLINFACTORY com 12 parcelas no PDF):
{
  "description": "MERCADO*GOBLINFACTORY",
  "amount": 107.55,
  "installment_current": 1,
  "installment_total": 12,
  "is_installment": true,
  "future_installments": [
    {"installment": 2, "reference_month": 2, "reference_year": 2026},
    {"installment": 3, "reference_month": 3, "reference_year": 2026},
    ... (até parcela 12)
  ]
}

EXEMPLO ERRADO (não fazer isso):
- Extrair 12 itens separados para GOBLINFACTORY

Outras regras Santander:
- "PAGAMENTO DE FATURA-INTERNET" = pagamento (NEGATIVO) - EXTRAIR!
- Créditos pequenos (-0.02, -97.44) = EXTRAIR como negativos
- Crédito grande que cancela parcelas futuras (ex: -1289.94) = NÃO EXTRAIR
- Múltiplos cartões (TITULAR + @NOME) = Extrair de TODOS

========================
5) VALIDAÇÃO DE CONSISTÊNCIA (CRÍTICO)
========================

O JSON deve seguir esta regra:

  SOMA(novos_lançamentos) ≈ total_amount (tolerância: R$ 1,00)

Onde novos_lançamentos = itens com category NÃO em:
- saldo_anterior
- pagamento
- credito
- estorno

Se a diferença for grande:
- Verifique se pagamentos estão com category="pagamento"
- Verifique se saldo anterior está com category="saldo_anterior"
- Verifique se estornos estão com amount NEGATIVO

========================
6) REGRAS SOBRE DATAS
========================

- As datas na fatura são datas ORIGINAIS (podem ser de meses atrás)
- Para o campo "date", use uma data dentro do ciclo da fatura (invoice_month/invoice_year)
- Se vencimento = 10/01/2026, transações devem ter date em dezembro/2025 ou janeiro/2026
- NUNCA use datas de 6+ meses atrás para uma fatura atual!

========================
7) REGRAS PARA CUPOM FISCAL
========================

- Extraia APENAS produtos comprados
- IGNORE: descontos, totais, forma de pagamento, impostos
- TODOS os valores devem ser POSITIVOS
- Corrija abreviações OCR (LIMAO KG → Limão Kg)

========================
8) CATEGORIAS
========================

- pagamento: PAGAMENTO, PGTO, PAG FATURA (valores negativos)
- credito: CRÉDITO (valores negativos pequenos)
- estorno: ESTORNO, devolução (valores negativos)
- saldo_anterior: SALDO FATURA ANTERIOR (positivo)
- alimentacao: restaurantes, ifood, delivery
- transporte: uber, 99, posto, combustível
- mercado: supermercado, mercado livre
- assinaturas: streaming, netflix, spotify, gympass
- lazer: cinema, jogos, steam
- saude: farmácia, drogaria
- outros: fallback

========================
9) DOCUMENT_TYPE
========================

- cupom_fiscal: nota de supermercado/loja
- fatura_cartao: fatura de cartão de crédito
- comprovante: pagamento único
- extrato: extrato bancário

========================
10) FORMATOS POR BANCO (REFERÊNCIA)
========================

📌 ITAÚ: DD/MM ESTABELECIMENTO XX/YY VALOR
📌 INTER: Data por extenso | Movimentação | Beneficiário | Valor
📌 BRADESCO/AMEX: Data | Histórico | Cidade | R$
📌 NUBANK: Data | Descrição | Valor
📌 SANTANDER: Ver seção 4 (regra especial de consolidação)
📌 CARREFOUR/SAM'S: DD/MM DESCRIÇÃO - X/Y VALOR
   - "Pagamento Banco CSF" = pagamento (valor com hífen: "1.621,02-")
📌 DIGIO: Data | Descrição | Parcela | Valor

========================
11) O QUE NÃO EXTRAIR
========================

- "Despesas do mês" (é TOTAL)
- "Total da fatura" / "Valor do Documento"
- Seção "Compras parceladas - próximas faturas"
- "Parcelamento Fatura" / "Parcelamento Total"
- "Pagamento mínimo", "Parcelas fixas"
- Limites de crédito
- Simulações de parcelamento

========================
RETORNE APENAS O JSON VÁLIDO, SEM EXPLICAÇÕES.
========================
"""


# Configuração de retry
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 2.0  # segundos


import logging
logger = logging.getLogger(__name__)


class LLMOCRService:
    """Extrai dados de imagens usando LLM com visão (suporta múltiplos providers)"""

    def __init__(self):
        self.provider = settings.vision_provider
        self.model = settings.vision_model or 'gemini-2.5-flash-lite'
        self.max_retries = DEFAULT_MAX_RETRIES
        self.retry_delay = DEFAULT_RETRY_DELAY
        self._google_client = None
        logger.info(f"LLMOCRService initialized: provider={self.provider}, model={self.model}")

    def _get_google_client(self):
        """Obtém cliente Google Genai (lazy initialization)"""
        if self._google_client is None:
            try:
                from google import genai
                api_key = settings.google_api_key
                if not api_key:
                    raise ValueError("GOOGLE_API_KEY não configurada")
                self._google_client = genai.Client(api_key=api_key)
            except ImportError:
                raise ImportError("google-genai não instalado. Execute: pip install google-genai")
        return self._google_client

    def _convert_pdf_to_images(self, pdf_content: bytes) -> tuple[list[tuple[bytes, str]], str | None]:
        """Converte PDF para lista de imagens (uma por página)

        Returns:
            Tuple of (images list, error message or None)
        """
        try:
            import fitz  # pymupdf

            images = []
            pdf_doc = fitz.open(stream=pdf_content, filetype="pdf")

            if len(pdf_doc) == 0:
                pdf_doc.close()
                return [], "PDF não contém páginas"

            for page_num in range(len(pdf_doc)):
                page = pdf_doc[page_num]
                # Renderizar página como imagem com boa resolução
                mat = fitz.Matrix(2.0, 2.0)  # 2x zoom para melhor qualidade
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                images.append((img_bytes, 'image/png'))

            pdf_doc.close()
            return images, None
        except ImportError as e:
            return [], f"PyMuPDF não instalado: {e}"
        except Exception as e:
            return [], f"Erro ao converter PDF: {e}"

    def _is_retryable_error(self, error: Exception) -> bool:
        """Verifica se o erro é retryable (503, 429, etc.)"""
        error_str = str(error).lower()
        return any(code in error_str for code in ["503", "429", "unavailable", "overloaded", "rate limit", "resource_exhausted"])

    async def extract_from_image(self, image_content: bytes, mime_type: str = 'image/png') -> dict:
        """Extrai dados da imagem usando o provider configurado"""
        logger.info(f"extract_from_image called: mime_type={mime_type}, content_size={len(image_content)}")
        try:
            # Se for PDF, converter para imagens e processar todas as páginas JUNTAS
            if mime_type == 'application/pdf' or mime_type.endswith('/pdf'):
                logger.info("Processing PDF document")
                images, pdf_error = self._convert_pdf_to_images(image_content)
                logger.info(f"PDF conversion result: {len(images)} pages, error={pdf_error}")
                if pdf_error:
                    logger.error(f"PDF conversion error: {pdf_error}")
                    return {'items': [], 'error': pdf_error}
                if not images:
                    return {'items': [], 'error': 'PDF não gerou imagens para processar'}

                # Se temos múltiplas páginas e estamos usando Google, enviar todas juntas
                if len(images) > 1 and self.provider == 'google':
                    logger.info(f"Calling Google multi-page with {len(images)} pages")
                    result = await self._call_google_multi_page(images)
                    logger.info(f"Google multi-page result: {len(result.get('items', []))} items, error={result.get('error')}")
                else:
                    # Fallback: processar páginas separadamente (single page or non-google)
                    logger.info(f"Processing {len(images)} page(s) separately")
                    all_items = []
                    document_type = None
                    card_info = None
                    errors = []

                    for page_num, (img_content, img_mime) in enumerate(images, 1):
                        page_result = await self._process_single_image(img_content, img_mime)
                        if page_result.get('error'):
                            errors.append(f"Página {page_num}: {page_result['error']}")
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

                # Aplicar filtros no resultado
                all_items = result.get('items', [])
                card_info = result.get('card_info')

                # Aplicar filtro de duplicatas no conjunto completo de itens
                all_items = self._filter_duplicate_installments(all_items)

                # Aplicar filtro de parcelas consecutivas (Santander lista todas as 12 parcelas)
                all_items = self._filter_consecutive_installments(all_items)

                # Aplicar filtro de itens que são resumos (valor igual ao total da fatura)
                total_amount = card_info.get('total_amount') if card_info else None
                all_items = self._filter_summary_items(all_items, total_amount)

                return {
                    'items': all_items,
                    'document_type': result.get('document_type'),
                    'card_info': card_info,
                }
            else:
                return await self._process_single_image(image_content, mime_type)

        except Exception as e:
            return {'items': [], 'error': f'Erro inesperado: {str(e)}'}

    async def _process_single_image(self, image_content: bytes, mime_type: str) -> dict:
        """Processa uma única imagem"""
        try:
            if self.provider == 'google':
                return await self._call_google(image_content, mime_type)
            elif self.provider == 'openai':
                return await self._call_openai(image_content, mime_type)
            elif self.provider == 'anthropic':
                return await self._call_anthropic(image_content, mime_type)
            else:
                return {'items': [], 'error': f'Provider não suportado: {self.provider}'}
        except Exception as e:
            return {'items': [], 'error': str(e)}

    async def _call_google(self, image_content: bytes, mime_type: str) -> dict:
        """Chama Google Gemini API usando SDK oficial com retry"""
        try:
            from google.genai import types
        except ImportError:
            # Fallback para httpx se google-genai não estiver instalado
            return await self._call_google_httpx(image_content, mime_type)

        client = self._get_google_client()
        image_base64 = base64.b64encode(image_content).decode('utf-8')

        last_error = None
        for attempt in range(self.max_retries):
            try:
                response = client.models.generate_content(
                    model=self.model,
                    contents=[
                        types.Part.from_bytes(
                            data=image_content,
                            mime_type=mime_type,
                        ),
                        EXTRACTION_PROMPT,
                    ],
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        max_output_tokens=16000,
                    ),
                )

                return self._parse_response(response.text)

            except Exception as e:
                last_error = e
                if self._is_retryable_error(e) and attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2 ** attempt)  # Exponential backoff
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    raise

        return {'items': [], 'error': f'Falha após {self.max_retries} tentativas: {last_error}'}

    async def _call_google_multi_page(self, images: list[tuple[bytes, str]]) -> dict:
        """Chama Google Gemini API com múltiplas páginas usando SDK oficial"""
        try:
            from google.genai import types
        except ImportError:
            # Fallback para httpx
            return await self._call_google_multi_page_httpx(images)

        client = self._get_google_client()

        # Construir partes da mensagem: prompt + todas as imagens
        parts = [EXTRACTION_PROMPT + "\n\n⚠️ ATENÇÃO: Este documento tem MÚLTIPLAS PÁGINAS. Extraia TODAS as transações de TODAS as páginas!"]

        for i, (img_content, img_mime) in enumerate(images):
            parts.append(types.Part.from_bytes(data=img_content, mime_type=img_mime))
            parts.append(f'[Página {i+1} de {len(images)}]')

        last_error = None
        for attempt in range(self.max_retries):
            try:
                response = client.models.generate_content(
                    model=self.model,
                    contents=parts,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        max_output_tokens=32000,  # Mais tokens para documento completo
                    ),
                )

                return self._parse_response(response.text)

            except Exception as e:
                last_error = e
                if self._is_retryable_error(e) and attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2 ** attempt)
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    raise

        return {'items': [], 'error': f'Falha após {self.max_retries} tentativas: {last_error}'}

    async def _call_google_httpx(self, image_content: bytes, mime_type: str) -> dict:
        """Fallback: Chama Google Gemini API via httpx (se SDK não disponível)"""
        import httpx

        api_key = settings.google_api_key
        if not api_key:
            return {'items': [], 'error': 'GOOGLE_API_KEY não configurada'}

        image_base64 = base64.b64encode(image_content).decode('utf-8')

        last_error = None
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        f'https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent',
                        headers={
                            'x-goog-api-key': api_key,
                            'Content-Type': 'application/json',
                        },
                        json={
                            'contents': [{
                                'parts': [
                                    {'text': EXTRACTION_PROMPT},
                                    {
                                        'inline_data': {
                                            'mime_type': mime_type,
                                            'data': image_base64,
                                        }
                                    }
                                ]
                            }],
                            'generationConfig': {
                                'temperature': 0.1,
                                'maxOutputTokens': 16000,
                            }
                        },
                    )

                    if response.status_code != 200:
                        error_msg = f'Google API error: {response.status_code}'
                        if response.status_code in [503, 429]:
                            raise Exception(error_msg)
                        return {'items': [], 'error': error_msg}

                    result = response.json()
                    content = result['candidates'][0]['content']['parts'][0]['text']
                    return self._parse_response(content)

            except Exception as e:
                last_error = e
                if self._is_retryable_error(e) and attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2 ** attempt)
                    await asyncio.sleep(wait_time)
                    continue
                elif 'httpx' not in str(type(e).__module__):
                    raise

        return {'items': [], 'error': f'Falha após {self.max_retries} tentativas: {last_error}'}

    async def _call_google_multi_page_httpx(self, images: list[tuple[bytes, str]]) -> dict:
        """Fallback: Chama Google Gemini API com múltiplas páginas via httpx"""
        import httpx

        api_key = settings.google_api_key
        if not api_key:
            return {'items': [], 'error': 'GOOGLE_API_KEY não configurada'}

        parts = [{'text': EXTRACTION_PROMPT + "\n\n⚠️ ATENÇÃO: Este documento tem MÚLTIPLAS PÁGINAS. Extraia TODAS as transações de TODAS as páginas!"}]

        for i, (img_content, img_mime) in enumerate(images):
            image_base64 = base64.b64encode(img_content).decode('utf-8')
            parts.append({
                'inline_data': {
                    'mime_type': img_mime,
                    'data': image_base64,
                }
            })
            parts.append({'text': f'[Página {i+1} de {len(images)}]'})

        last_error = None
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(
                        f'https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent',
                        headers={
                            'x-goog-api-key': api_key,
                            'Content-Type': 'application/json',
                        },
                        json={
                            'contents': [{'parts': parts}],
                            'generationConfig': {
                                'temperature': 0.1,
                                'maxOutputTokens': 32000,
                            }
                        },
                    )

                    if response.status_code != 200:
                        error_msg = f'Google API error: {response.status_code}'
                        if response.status_code in [503, 429]:
                            raise Exception(error_msg)
                        return {'items': [], 'error': error_msg}

                    result = response.json()
                    if not result.get('candidates'):
                        return {'items': [], 'error': 'Google API retornou resposta vazia'}

                    content = result['candidates'][0]['content']['parts'][0]['text']
                    return self._parse_response(content)

            except Exception as e:
                last_error = e
                if self._is_retryable_error(e) and attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2 ** attempt)
                    await asyncio.sleep(wait_time)
                    continue
                elif 'httpx' not in str(type(e).__module__):
                    raise

        return {'items': [], 'error': f'Falha após {self.max_retries} tentativas: {last_error}'}

    async def _call_openai(self, image_content: bytes, mime_type: str) -> dict:
        """Chama OpenAI API"""
        import httpx

        api_key = settings.openai_api_key
        if not api_key:
            return {'items': [], 'error': 'OPENAI_API_KEY não configurada'}

        image_base64 = base64.b64encode(image_content).decode('utf-8')
        model = self.model or 'gpt-4o-mini'

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                'https://api.openai.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {api_key}'},
                json={
                    'model': model,
                    'messages': [
                        {
                            'role': 'user',
                            'content': [
                                {'type': 'text', 'text': EXTRACTION_PROMPT},
                                {
                                    'type': 'image_url',
                                    'image_url': {
                                        'url': f'data:{mime_type};base64,{image_base64}',
                                        'detail': 'high',
                                    }
                                }
                            ]
                        }
                    ],
                    'max_tokens': 8000,
                    'temperature': 0.1,
                },
            )

            if response.status_code != 200:
                return {'items': [], 'error': f'OpenAI API error: {response.status_code}'}

            result = response.json()
            content = result['choices'][0]['message']['content']
            return self._parse_response(content)

    async def _call_anthropic(self, image_content: bytes, mime_type: str) -> dict:
        """Chama Anthropic Claude API"""
        import httpx

        api_key = settings.anthropic_api_key
        if not api_key:
            return {'items': [], 'error': 'ANTHROPIC_API_KEY não configurada'}

        image_base64 = base64.b64encode(image_content).decode('utf-8')

        media_type = mime_type
        if media_type == 'image/jpg':
            media_type = 'image/jpeg'

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                'https://api.anthropic.com/v1/messages',
                headers={
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                },
                json={
                    'model': 'claude-3-haiku-20240307',
                    'max_tokens': 8000,
                    'messages': [
                        {
                            'role': 'user',
                            'content': [
                                {
                                    'type': 'image',
                                    'source': {
                                        'type': 'base64',
                                        'media_type': media_type,
                                        'data': image_base64,
                                    }
                                },
                                {'type': 'text', 'text': EXTRACTION_PROMPT}
                            ]
                        }
                    ],
                },
            )

            if response.status_code != 200:
                return {'items': [], 'error': f'Anthropic API error: {response.status_code}'}

            result = response.json()
            content = result['content'][0]['text']
            return self._parse_response(content)

    # Padrões de descrição que indicam totais/resumos (não são transações reais)
    INVALID_DESCRIPTIONS = [
        'despesas do mês',
        'fatura atual',
        'total da fatura',
        'valor do documento',
        'pagamento mínimo',
        'parcelamento fatura',
        'parcelamento total',
        'limite disponível',
        'limite total',
        'próxima fatura',
        'próximas parcelas',
        'pagamento banco csf',
        'pag boleto bancario',
        'inclusao pgto fatura',
        'saldo anterior',
        'saldo fatura anterior',
        'parcela de anuidade',
        'anuidade parcelada',
        'total anuidade',
        'valor total anuidade',
    ]

    def _is_invalid_description(self, description: str) -> bool:
        """Verifica se a descrição é um total/resumo ao invés de uma transação real"""
        desc_lower = description.lower().strip()
        for invalid in self.INVALID_DESCRIPTIONS:
            if invalid in desc_lower or desc_lower in invalid:
                return True
        return False

    def _normalize_description(self, desc: str) -> str:
        """Normaliza descrição para comparação"""
        import re
        desc = desc.lower()
        prefixes = [
            'mercadolivre*', 'mercadolivre ', 'mercadolivre',
            'mercado*', 'mercado ', 'mercado',
            'pag*', 'pag ', 'mp*', 'mp ', 'dl*', 'dl ', 'cp*', 'cp ', 'pg*', 'pg '
        ]
        for prefix in prefixes:
            if desc.startswith(prefix):
                desc = desc[len(prefix):]
                break
        desc = re.sub(r'[^a-z]', '', desc)
        return desc

    def _filter_duplicate_installments(self, items: list) -> list:
        """Remove parcelas duplicadas, mantendo apenas a de menor número"""
        seen_exact = set()
        unique_items = []
        for item in items:
            exact_key = (
                self._normalize_description(item['description']),
                item['amount'],
                item.get('installment_current'),
                item.get('installment_total'),
            )
            if exact_key not in seen_exact:
                seen_exact.add(exact_key)
                unique_items.append(item)

        groups = {}
        for item in unique_items:
            desc_normalized = self._normalize_description(item['description'])
            key = (desc_normalized, item['amount'])
            if key not in groups:
                groups[key] = []
            groups[key].append(item)

        filtered = []
        for key, group in groups.items():
            if len(group) == 1:
                filtered.append(group[0])
            else:
                installment_items = [i for i in group if i.get('is_installment')]
                non_installment_items = [i for i in group if not i.get('is_installment')]

                if installment_items:
                    installment_items.sort(key=lambda x: x.get('installment_current', 999))
                    filtered.append(installment_items[0])
                elif non_installment_items:
                    filtered.append(non_installment_items[0])

        final_items = []
        for item in filtered:
            if item['amount'] < -50:
                desc_norm = self._normalize_description(item['description'])
                related_installments = [
                    i for i in filtered
                    if i.get('is_installment') and
                    i['amount'] > 0 and
                    self._normalize_description(i['description']) == desc_norm
                ]
                if related_installments:
                    continue
            final_items.append(item)

        return final_items

    def _filter_summary_items(self, items: list, total_amount: float | None) -> list:
        """Remove itens que são resumos/totais da fatura"""
        if not total_amount or total_amount <= 0:
            return items

        filtered = []
        for item in items:
            if abs(item['amount'] - total_amount) < 0.01:
                desc_lower = item['description'].lower()
                if any(word in desc_lower for word in ['anuidade', 'total', 'fatura', 'valor']):
                    continue

            desc_lower = item['description'].lower().strip()
            if desc_lower in ['anuidade', 'parcela anuidade', 'parcela de anuidade']:
                if item['amount'] > 50:
                    continue

            filtered.append(item)

        return filtered

    def _filter_consecutive_installments(self, items: list) -> list:
        """Remove parcelas consecutivas do mesmo item (Santander)"""
        groups = {}
        for item in items:
            if not item.get('is_installment'):
                continue
            desc_norm = self._normalize_description(item['description'])
            if desc_norm not in groups:
                groups[desc_norm] = []
            groups[desc_norm].append(item)

        items_to_remove = set()
        for desc_norm, group in groups.items():
            if len(group) <= 1:
                continue

            sorted_group = sorted(group, key=lambda x: x.get('installment_current', 0))
            parcels = [g.get('installment_current', 0) for g in sorted_group]

            consecutive_count = 1
            for i in range(1, len(parcels)):
                if parcels[i] == parcels[i-1] + 1:
                    consecutive_count += 1
                else:
                    consecutive_count = 1

            if consecutive_count >= 6 or len(group) >= 6:
                min_parcel = min(parcels)
                for item in sorted_group:
                    if item.get('installment_current', 0) != min_parcel:
                        items_to_remove.add(id(item))

        return [item for item in items if id(item) not in items_to_remove]

    def _parse_response(self, content: str) -> dict:
        """Parseia a resposta JSON da LLM"""
        try:
            import re

            content = content.strip()
            if '```' in content:
                match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
                if match:
                    content = match.group(1)

            data = json.loads(content)

            items = []
            for item in data.get('items', []):
                amount = item.get('amount', 0)
                if isinstance(amount, str):
                    amount = float(amount.replace('.', '').replace(',', '.').replace('R$', '').strip())

                is_installment = item.get('is_installment', False)
                installment_current = None
                installment_total = None

                if is_installment:
                    installment_current = item.get('installment_current')
                    installment_total = item.get('installment_total')

                    if installment_current and installment_total:
                        try:
                            installment_current = int(installment_current)
                            installment_total = int(installment_total)
                            if installment_current < 1 or installment_current > installment_total:
                                is_installment = False
                                installment_current = None
                                installment_total = None
                        except (ValueError, TypeError):
                            is_installment = False
                            installment_current = None
                            installment_total = None
                    else:
                        is_installment = False

                description = str(item.get('description', 'Item'))[:200]

                if self._is_invalid_description(description):
                    continue

                normalized = {
                    'description': description,
                    'amount': float(amount) if amount else 0,
                    'date': item.get('date'),
                    'category': item.get('category'),
                    'confidence': 0.9,
                    'is_installment': is_installment,
                    'installment_current': installment_current,
                    'installment_total': installment_total,
                }

                # Incluir future_installments se existir
                future_installments = item.get('future_installments')
                if future_installments and isinstance(future_installments, list):
                    normalized['future_installments'] = future_installments

                if normalized['amount'] != 0:
                    items.append(normalized)

            items = self._filter_duplicate_installments(items)

            result = {
                'items': items,
                'document_type': data.get('document_type'),
            }

            card_info = data.get('card_info')
            if card_info and isinstance(card_info, dict):
                result['card_info'] = {
                    'card_issuer': card_info.get('card_issuer'),
                    'card_last_digits': str(card_info.get('card_last_digits', ''))[-4:] if card_info.get('card_last_digits') else None,
                    'card_name': card_info.get('card_name'),
                    'invoice_month': card_info.get('invoice_month'),
                    'invoice_year': card_info.get('invoice_year'),
                    'closing_date': card_info.get('closing_date'),
                    'due_date': card_info.get('due_date'),
                    'total_amount': float(card_info.get('total_amount', 0)) if card_info.get('total_amount') else None,
                }

                if result['card_info'].get('closing_date'):
                    try:
                        from datetime import datetime
                        closing = datetime.strptime(result['card_info']['closing_date'], '%Y-%m-%d')
                        result['card_info']['closing_day'] = closing.day
                    except ValueError:
                        pass

                if result['card_info'].get('due_date'):
                    try:
                        from datetime import datetime
                        due = datetime.strptime(result['card_info']['due_date'], '%Y-%m-%d')
                        result['card_info']['due_day'] = due.day
                    except ValueError:
                        pass

                result['card_info'] = {k: v for k, v in result['card_info'].items() if v is not None}

            return result

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            return {
                'items': [],
                'error': f'Erro ao processar resposta: {str(e)}',
                'raw': content[:500] if content else '',
            }
