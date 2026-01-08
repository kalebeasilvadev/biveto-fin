"""Serviço de extração de dados usando LLM com visão (multi-provider)"""
import base64
import json
import httpx
import io
from ..core.config import settings


EXTRACTION_PROMPT = """Analise esta imagem de documento financeiro brasileiro (cupom fiscal, fatura de cartão, comprovante, extrato).

Extraia os itens/transações e retorne um JSON válido com este formato:

{
  "items": [
    {
      "description": "Nome do produto ou estabelecimento",
      "amount": 123.45,
      "date": "2024-12-25",
      "category": "mercado",
      "installment_current": 3,
      "installment_total": 12,
      "is_installment": true
    }
  ],
  "document_type": "cupom_fiscal"
}

==== REGRAS CRÍTICAS PARA FATURA DE CARTÃO DE CRÉDITO ====

⚠️ ATENÇÃO: A fatura de cartão tem MÚLTIPLAS SEÇÕES. Extraia APENAS da seção correta:

1️⃣ SEÇÃO DE RESUMO/CABEÇALHO (IGNORAR COMPLETAMENTE):
   - Fica no TOPO da fatura
   - Contém: "Valor do Documento", "Pagamento mínimo", "Opções de parcelamento"
   - Mostra simulações de parcelamento como "1 + 11 de R$ 142,71" - NÃO SÃO COMPRAS!

2️⃣ SEÇÃO "DESPESAS DA FATURA" ou "FATURA ATUAL" (✅ EXTRAIR DAQUI):
   - É a seção PRINCIPAL com as transações do mês atual
   - Tem formato de TABELA/LISTA com: DATA | DESCRIÇÃO | VALOR
   - Extraia TODAS as transações desta seção

3️⃣ SEÇÃO "PRÓXIMA FATURA" ou "PRÓXIMAS PARCELAS" (🚫 IGNORAR COMPLETAMENTE):
   - Mostra parcelas que serão cobradas NO PRÓXIMO MÊS
   - Mesmo que tenha data, descrição e valor - NÃO EXTRAIA!
   - Geralmente aparece após a fatura atual, com título "Próxima fatura"
   - As parcelas aqui são FUTURAS, não devem ser contabilizadas agora

🚫 COMO IDENTIFICAR A SEÇÃO "PRÓXIMA FATURA" (IGNORAR):
   - Título contém: "Próxima fatura", "Próximas parcelas", "Lançamentos futuros"
   - Aparece DEPOIS da seção de despesas da fatura atual
   - Mostra o número da parcela seguinte (ex: se na fatura atual é 5/12, aqui será 6/12)
   - Data geralmente é do próximo mês

❌ NUNCA EXTRAIA:
- TODA a seção "Próxima fatura" / "Próximas parcelas" - são FUTURAS!
- "Parcelamento Fatura" / "Parcelamento Total" - opção de parcelar a fatura
- "1 + X de R$ XXX" - simulação de parcelamento
- "Pagamento mínimo" - informativo
- "Valor do Documento" / "Total da fatura" - totais
- Limite disponível, limite total
- Encargos, IOF, juros (exceto se na seção de despesas com data)

✅ EXTRAIA APENAS da seção "Despesas da fatura" / "Fatura atual":
- Transações com DATA específica
- Nome do ESTABELECIMENTO
- VALOR individual da transação

Para cada transação:
- Despesas/compras: valor POSITIVO
- Pagamentos/créditos/estornos: valor NEGATIVO

==== REGRA MAIS IMPORTANTE ====

PARA CUPOM FISCAL / NOTA FISCAL DE SUPERMERCADO:
- Extraia APENAS os PRODUTOS comprados
- NÃO EXTRAIA (IGNORE COMPLETAMENTE):
  * Descontos (ex: "DESCONTO", "DESC", "DESCONTO POR QUANTIDADE", "DESC QTD", valores negativos no cupom)
  * Totais (ex: "TOTAL", "SUBTOTAL", "TOTAL A PAGAR", "VALOR TOTAL")
  * Forma de pagamento (ex: "DINHEIRO", "CARTÃO", "PIX", "TROCO", "CREDITO", "DEBITO")
  * Impostos (ex: "ICMS", "TRIBUTOS", "VALOR APROX TRIBUTOS")
  * Informações do estabelecimento (CNPJ, endereço, etc.)
- TODOS os valores de produtos devem ser POSITIVOS (são despesas)
- Se um item aparece com valor negativo no cupom (desconto), IGNORE esse item completamente

==== LEITURA DE NOMES DE PRODUTOS (OCR) ====

MUITO IMPORTANTE: Cupons fiscais têm abreviações e OCR pode ler errado. INTERPRETE e CORRIJA:

Exemplos de correção obrigatória:
- "LIMAD KG" ou "LIMAO KG" → "Limão Kg"
- "ACU REFIN" ou "ACUCAR REF" → "Açúcar Refinado"
- "ARR BRANCO" → "Arroz Branco"
- "FGO FRANGO" ou "FRGO" → "Frango"
- "CONTRA FILE" ou "CTRA FILE" → "Contra Filé"
- "PAO FRANCES" → "Pão Francês"
- "DETERG" → "Detergente"
- "MARG" → "Margarina"
- "LEITE INTEG" → "Leite Integral"
- "CERV" → "Cerveja"
- "REFRIG" → "Refrigerante"
- "SABAO PO" → "Sabão em Pó"
- "PAP HIGIEN" → "Papel Higiênico"
- "OVO VERM" → "Ovo Vermelho"
- "BATATA ING" → "Batata Inglesa"
- "CARVAD" ou "CARVAO" → "Carvão"
- "TRIANGULO EKC EUCALIPTO" → "Carvão Triângulo Eucalipto"
- "BON FESF" ou "BIFE" → "Bife"
- "ALCATRA" → "Alcatra"
- "ARANHA" → "Carne Aranha" (corte de carne)
- "PRATO DESCART" → "Prato Descartável"
- "COPOBRAS" → "Copobras" (marca)

Use o contexto para interpretar abreviações de forma legível e natural em português.

==== PARCELAS (para faturas de cartão) ====

PADRÕES DE PARCELAMENTO:
- "Parcela X de Y" ou "Parcela X/Y"
- "XX/YY" no final (ex: "Steam 03/12" = parcela 3 de 12)
- "(Parcela XX de YY)" no final
- "*nome01/06" = parcela 1 de 6

COMO EXTRAIR:
- installment_current: número da parcela atual
- installment_total: total de parcelas
- is_installment: true
- O valor deve ser o valor DA PARCELA, não o total

==== DATAS ====

- Formato de saída: YYYY-MM-DD
- Formatos de entrada: "23/08/2024", "23 de ago. 2024", "08/12" (use ano do contexto)

==== VALORES ====

- Converta R$ para número decimal (R$ 1.234,56 → 1234.56)
- Para cupom fiscal: TODOS os produtos são valores POSITIVOS
- Para fatura: pagamentos/créditos são NEGATIVOS

==== CATEGORIAS ====

- alimentacao: restaurantes, pizzarias, delivery, ifood, mc donalds
- transporte: posto, uber, 99, estacionamento
- moradia: luz, água, gás, aluguel, condomínio
- saude: farmácia, hospital, drogaria
- lazer: cinema, jogos, bar, spotify, netflix, steam, shopee
- eletronicos: magazine luiza, americanas, kabum, amazon
- roupas: renner, c&a, riachuelo, zara, shein
- mercado: supermercado, mercado, atacado, produtos de cupom fiscal
- assinaturas: spotify, netflix, amazon prime, disney+, gympass
- outros: quando não se encaixar

==== DOCUMENT_TYPE ====

- cupom_fiscal: nota de supermercado/loja com lista de produtos
- fatura_cartao: fatura de cartão de crédito
- comprovante: comprovante de pagamento único
- extrato: extrato bancário

==== EXEMPLOS ====

CUPOM FISCAL (supermercado):
Entrada: "LIMAD KG 2,43 | CONTRA FILE KG 185,89 | DESC QTD -1,80 | TOTAL 350,00"
Saída correta:
{
  "items": [
    {"description": "Limão Kg", "amount": 2.43, "category": "mercado"},
    {"description": "Contra Filé Kg", "amount": 185.89, "category": "mercado"}
  ],
  "document_type": "cupom_fiscal"
}
IMPORTANTE: "DESC QTD" e "TOTAL" foram IGNORADOS pois não são produtos!

FATURA CARTÃO (ex: Banco Inter, Nubank):
Entrada na imagem:
"Valor do Documento: R$ 1.567,89
Pagamento mínimo: R$ 156,79
Opções de parcelamento:
- 1 + 11 de R$ 142,71
- 1 + 5 de R$ 285,43

Despesas da fatura:
02 dez  APPLE.COM/BILL          R$ 9,90
02 dez  SEGURO CARTAO CTP       R$ 15,90
15 dez  STEAM 02/12             R$ 105,66
20 dez  UBER *TRIP              R$ 23,45"

Saída CORRETA (extrair apenas da seção "Despesas da fatura"):
{
  "items": [
    {"description": "APPLE.COM/BILL", "amount": 9.90, "date": "2025-12-02", "category": "assinaturas", "is_installment": false},
    {"description": "Seguro Cartão CTP", "amount": 15.90, "date": "2025-12-02", "category": "outros", "is_installment": false},
    {"description": "Steam", "amount": 105.66, "date": "2025-12-15", "category": "lazer", "installment_current": 2, "installment_total": 12, "is_installment": true},
    {"description": "Uber", "amount": 23.45, "date": "2025-12-20", "category": "transporte", "is_installment": false}
  ],
  "document_type": "fatura_cartao"
}

⚠️ ERRADO - NÃO faça assim (extraindo opções de parcelamento):
{
  "items": [
    {"description": "Parcelamento Fatura", "amount": 142.71},  // ERRADO! É simulação
    {"description": "Pagamento mínimo", "amount": 156.79}      // ERRADO! É resumo
  ]
}

Retorne APENAS o JSON válido, sem explicações."""


class LLMOCRService:
    """Extrai dados de imagens usando LLM com visão (suporta múltiplos providers)"""

    def __init__(self):
        self.provider = settings.vision_provider
        self.model = settings.vision_model

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

    async def extract_from_image(self, image_content: bytes, mime_type: str = 'image/png') -> dict:
        """Extrai dados da imagem usando o provider configurado"""
        try:
            # Se for PDF, converter para imagens e processar todas as páginas
            if mime_type == 'application/pdf' or mime_type.endswith('/pdf'):
                images, pdf_error = self._convert_pdf_to_images(image_content)
                if pdf_error:
                    return {'items': [], 'error': pdf_error}
                if not images:
                    return {'items': [], 'error': 'PDF não gerou imagens para processar'}

                # Processar todas as páginas e combinar resultados
                all_items = []
                document_type = None
                errors = []

                for page_num, (img_content, img_mime) in enumerate(images, 1):
                    result = await self._process_single_image(img_content, img_mime)
                    if result.get('error'):
                        errors.append(f"Página {page_num}: {result['error']}")
                    if result.get('items'):
                        all_items.extend(result['items'])
                    if result.get('document_type') and not document_type:
                        document_type = result['document_type']

                # Se não extraiu nenhum item e teve erros, retornar os erros
                if not all_items and errors:
                    return {'items': [], 'error': '; '.join(errors)}

                return {
                    'items': all_items,
                    'document_type': document_type,
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
