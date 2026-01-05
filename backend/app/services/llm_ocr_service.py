"""Serviço de extração de dados usando LLM com visão (multi-provider)"""
import base64
import json
import httpx
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
   - Identifique compras parceladas: "Parcela 3/12", "3 de 12", "Parc 03/12", "3x de 12"
   - Se encontrar parcela, extraia:
     * installment_current: número da parcela atual (ex: 3)
     * installment_total: total de parcelas (ex: 12)
     * is_installment: true
   - Se NÃO for parcelado: is_installment: false, omita os campos de parcela
   - O valor (amount) deve ser o valor DA PARCELA, não o total da compra

2. DATAS: Extraia a data EXATA de cada transação visível (formato YYYY-MM-DD)
   - Se mostra "25 JAN", converta para "2024-01-25"
   - Use o ano da fatura quando não especificado
   - NUNCA deixe date como null se houver data visível

3. VALORES: Converta R$ para número (R$ 1.234,56 → 1234.56)

4. CATEGORIAS - baseado no nome do estabelecimento:
   - alimentacao: restaurantes, pizzarias, lanches, delivery, ifood
   - transporte: posto, uber, 99, estacionamento, shellbox
   - moradia: luz, água, gás, aluguel, condomínio
   - saude: farmácia, hospital, médico, drogaria
   - lazer: cinema, streaming, jogos, bar, spotify, netflix
   - eletronicos: magazine luiza, americanas, casas bahia, kabum
   - roupas: renner, c&a, riachuelo, zara, shein
   - servicos: elétrica, hidráulica, manutenção
   - mercado: supermercado, mercado, atacado
   - assinaturas: spotify, netflix, amazon prime, disney+
   - outros: quando não se encaixar nas anteriores

5. DOCUMENT_TYPE: fatura_cartao | cupom_fiscal | comprovante | extrato

EXEMPLOS DE EXTRAÇÃO DE PARCELAS:
- "MAGAZINE LUIZA PARC 03/12 R$ 150,00" → installment_current: 3, installment_total: 12, amount: 150.00
- "AMAZON 2 DE 5 R$ 89,90" → installment_current: 2, installment_total: 5, amount: 89.90
- "IFOOD R$ 45,00" → is_installment: false (não tem parcela)

Retorne APENAS o JSON válido, sem explicações."""


class LLMOCRService:
    """Extrai dados de imagens usando LLM com visão (suporta múltiplos providers)"""

    def __init__(self):
        self.provider = settings.vision_provider
        self.model = settings.vision_model

    async def extract_from_image(self, image_content: bytes, mime_type: str = 'image/png') -> dict:
        """Extrai dados da imagem usando o provider configurado"""
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
                f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}',
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
                        'maxOutputTokens': 2000,
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
                    'max_tokens': 2000,
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
                    'max_tokens': 2000,
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

                if normalized['amount'] > 0:
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
