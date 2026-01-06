"""Serviço de extração de dados usando LLM com visão (multi-provider)"""
import base64
import json
import httpx
import io
from ..core.config import settings


EXTRACTION_PROMPT = """Analise esta imagem de documento financeiro brasileiro (cupom fiscal, fatura de cartão, comprovante, extrato).

Extraia TODOS os itens/transações visíveis INDIVIDUALMENTE e retorne um JSON válido com este formato:

{
  "items": [
    {
      "description": "Nome do estabelecimento ou produto",
      "amount": 123.45,
      "date": "2024-12-25",
      "category": "alimentacao",
      "installment_current": 3,
      "installment_total": 12,
      "is_installment": true
    }
  ],
  "document_type": "fatura_cartao"
}

REGRAS CRÍTICAS:

1. PARCELAS (MUITO IMPORTANTE!):
   PADRÕES DE PARCELAMENTO POR BANCO:

   NUBANK:
   - "Parcela X de Y" ou "Parcela X/Y" (ex: "Parcela 1 de 6")
   - Números "XX/YY" no nome (ex: "Pag*steam 03/12" = parcela 3 de 12)
   - "*nome XX/YY" (ex: "*nuuve01/06" = parcela 1 de 6)

   INTER:
   - "(Parcela XX de YY)" no final (ex: "DM *helphbomaxcom (Parcela 05 de 12)")
   - "NOME (Parcela XX de YY)" (ex: "LOJAS NOSSO LAR (Parcela 04 de 12)")

   BRADESCO/AMEX:
   - "NOME XX/YY" com espaço (ex: "Steam 02/12" = parcela 2 de 12)
   - "NOME*código XX/YY" (ex: "HOTMART asimovacadem02/12" = parcela 2 de 12)
   - "NOME LT02/10" (ex: "CIATOY BRINQUEDOS LT02/10" = parcela 2 de 10)
   - "NOME 01/06" (ex: "INSIDE GAMES 01/06" = parcela 1 de 6)

   PADRÕES GENÉRICOS:
   - "Parc X/Y" ou "Parc X de Y"
   - "Xª parcela de Y" ou "Xa de Y"
   - "XX/YY" no final da descrição

   COMO EXTRAIR:
   - installment_current: número da parcela atual (ex: 3)
   - installment_total: total de parcelas (ex: 12)
   - is_installment: true
   - O valor (amount) deve ser o valor DA PARCELA exibido, não o total da compra

   Se NÃO for parcelado: is_installment: false, omita os campos de parcela

2. DATAS:
   - Extraia a data EXATA de cada transação
   - Formato de saída: YYYY-MM-DD
   - Formatos de entrada comuns:
     * "23 de ago. 2025" → "2025-08-23"
     * "04 de set. 2025" → "2025-09-04"
     * "08/12" (dia/mês) → use ano do contexto da fatura
     * "25 de dezembro" → use ano do contexto
   - Use o ano do vencimento da fatura quando o ano não estiver explícito

3. VALORES:
   - Converta R$ para número decimal (R$ 1.234,56 → 1234.56)
   - Valores negativos/créditos:
     * "-R$ 210,90" → amount: -210.90
     * "+ R$ 1.556,82" ou "1.513,17 -" → amount: -1513.17 (pagamento/crédito)
     * "PAGAMENTO DE FATURA" → amount negativo
   - Valores em dólar "US$ 10,00" devem ter o valor em reais extraído se disponível

4. CATEGORIAS - baseado no nome do estabelecimento:
   - alimentacao: restaurantes, pizzarias, lanches, delivery, ifood, mc donalds, burger, gruta
   - transporte: posto, uber, 99, estacionamento, shellbox, pedagio
   - moradia: luz, água, gás, aluguel, condomínio, energia, enel, sabesp
   - saude: farmácia, hospital, médico, drogaria, droga raia, ultrafarma
   - lazer: cinema, streaming, jogos, bar, spotify, netflix, steam, nuuvem, pag*steam, inside games, shopee, daiso
   - eletronicos: magazine luiza, americanas, casas bahia, kabum, pichau, amazon, ciatoy
   - roupas: renner, c&a, riachuelo, zara, shein, o boticario, oboticario
   - servicos: elétrica, hidráulica, manutenção, solare instalacao
   - mercado: supermercado, mercado, atacado, pao de acucar, carrefour, extra, distribuidora
   - assinaturas: spotify, netflix, amazon prime, disney+, gympass, wellhub, hotmart, apple.com/bill, hbomax
   - cartao: anuidade, taxa, iof, seguro cartao
   - educacao: hotmart, cursos, academy
   - outros: quando não se encaixar nas anteriores

5. DOCUMENT_TYPE: fatura_cartao | cupom_fiscal | comprovante | extrato

EXEMPLOS DE EXTRAÇÃO:

NUBANK:
- "Nuuvem *nuuve01/06 R$ 44,65 Parcela 1 de 6" → description: "Nuuvem", installment_current: 1, installment_total: 6, amount: 44.65
- "Pag*steam 03/12 R$ 106,09 Parcela 3 de 12" → description: "Steam", installment_current: 3, installment_total: 12, amount: 106.09

INTER:
- "DM *helphbomaxcom (Parcela 05 de 12) R$ 39,90" → description: "HBO Max", installment_current: 5, installment_total: 12, amount: 39.90
- "LOJAS NOSSO LAR (Parcela 04 de 12) R$ 99,99" → description: "Lojas Nosso Lar", installment_current: 4, installment_total: 12, amount: 99.99
- "PAGAMENTO DE FATURA + R$ 1.556,82" → description: "Pagamento de Fatura", amount: -1556.82, is_installment: false

BRADESCO/AMEX:
- "Steam 02/12 SAO PAULO R$ 105,66" → description: "Steam", installment_current: 2, installment_total: 12, amount: 105.66
- "INSIDE GAMES 01/06 BRASILIA R$ 135,00" → description: "Inside Games", installment_current: 1, installment_total: 6, amount: 135.00
- "DAISO JAPAN BRASILIA R$ 371,80" → description: "Daiso Japan", is_installment: false, amount: 371.80
- "PAG BOLETO BANCARIO 1.513,17 -" → description: "Pagamento Boleto", amount: -1513.17, is_installment: false

IMPORTANTE:
- Limpe a descrição removendo códigos como "*nuuve01/06", "03/12", "LT02/10", "(Parcela X de Y)" etc.
- Deixe apenas o nome legível do estabelecimento.
- NÃO ignore pagamentos/créditos (valores com sinal negativo ou "+").

Retorne APENAS o JSON válido, sem explicações."""


class LLMOCRService:
    """Extrai dados de imagens usando LLM com visão (suporta múltiplos providers)"""

    def __init__(self):
        self.provider = settings.vision_provider
        self.model = settings.vision_model

    def _convert_pdf_to_images(self, pdf_content: bytes) -> list[tuple[bytes, str]]:
        """Converte PDF para lista de imagens (uma por página)"""
        try:
            import fitz  # pymupdf

            images = []
            pdf_doc = fitz.open(stream=pdf_content, filetype="pdf")

            for page_num in range(len(pdf_doc)):
                page = pdf_doc[page_num]
                # Renderizar página como imagem com boa resolução
                mat = fitz.Matrix(2.0, 2.0)  # 2x zoom para melhor qualidade
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                images.append((img_bytes, 'image/png'))

            pdf_doc.close()
            return images
        except Exception as e:
            print(f"Erro ao converter PDF: {e}")
            return []

    async def extract_from_image(self, image_content: bytes, mime_type: str = 'image/png') -> dict:
        """Extrai dados da imagem usando o provider configurado"""
        try:
            # Se for PDF, converter para imagens e processar todas as páginas
            if mime_type == 'application/pdf' or mime_type.endswith('/pdf'):
                images = self._convert_pdf_to_images(image_content)
                if not images:
                    return {'items': [], 'error': 'Não foi possível processar o PDF'}

                # Processar todas as páginas e combinar resultados
                all_items = []
                document_type = None

                for img_content, img_mime in images:
                    result = await self._process_single_image(img_content, img_mime)
                    if result.get('items'):
                        all_items.extend(result['items'])
                    if result.get('document_type') and not document_type:
                        document_type = result['document_type']

                return {
                    'items': all_items,
                    'document_type': document_type,
                }
            else:
                return await self._process_single_image(image_content, mime_type)

        except Exception as e:
            return {'items': [], 'error': str(e)}

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
        """Chama Google Gemini API (GRÁTIS!)"""
        api_key = settings.google_api_key
        if not api_key:
            return {'items': [], 'error': 'GOOGLE_API_KEY não configurada. Obtenha em: https://aistudio.google.com/apikey'}

        image_base64 = base64.b64encode(image_content).decode('utf-8')
        model = self.model or 'gemini-2.0-flash'

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                headers={
                    'x-goog-api-key': api_key,  # API key no header (mais seguro que query param)
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
                        'maxOutputTokens': 4000,
                    }
                },
            )

            if response.status_code != 200:
                return {'items': [], 'error': f'Google API error: {response.status_code}'}

            result = response.json()
            content = result['candidates'][0]['content']['parts'][0]['text']
            return self._parse_response(content)

    async def _call_openai(self, image_content: bytes, mime_type: str) -> dict:
        """Chama OpenAI API"""
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
                    'max_tokens': 4000,
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
        api_key = settings.anthropic_api_key
        if not api_key:
            return {'items': [], 'error': 'ANTHROPIC_API_KEY não configurada'}

        image_base64 = base64.b64encode(image_content).decode('utf-8')

        # Converter mime_type para formato aceito pelo Claude
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
                    'max_tokens': 4000,
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

    def _parse_response(self, content: str) -> dict:
        """Parseia a resposta JSON da LLM"""
        try:
            # Limpar markdown code blocks
            content = content.strip()
            if '```' in content:
                # Extrair conteúdo entre ```json e ```
                import re
                match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
                if match:
                    content = match.group(1)

            data = json.loads(content)

            # Normalizar itens
            items = []
            for item in data.get('items', []):
                amount = item.get('amount', 0)
                if isinstance(amount, str):
                    # Converter string para float
                    amount = float(amount.replace('.', '').replace(',', '.').replace('R$', '').strip())

                # Processar informações de parcelas
                is_installment = item.get('is_installment', False)
                installment_current = None
                installment_total = None

                if is_installment:
                    installment_current = item.get('installment_current')
                    installment_total = item.get('installment_total')

                    # Validar dados de parcela
                    if installment_current and installment_total:
                        try:
                            installment_current = int(installment_current)
                            installment_total = int(installment_total)
                            # Validar se faz sentido
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

                normalized = {
                    'description': str(item.get('description', 'Item'))[:200],
                    'amount': float(amount) if amount else 0,
                    'date': item.get('date'),
                    'category': item.get('category'),
                    'confidence': 0.9,
                    'is_installment': is_installment,
                    'installment_current': installment_current,
                    'installment_total': installment_total,
                }

                # Aceitar tanto despesas (positivo) quanto pagamentos/créditos (negativo)
                if normalized['amount'] != 0:
                    items.append(normalized)

            return {
                'items': items,
                'document_type': data.get('document_type'),
            }

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            return {
                'items': [],
                'error': f'Erro ao processar resposta: {str(e)}',
                'raw': content[:500] if content else '',
            }
