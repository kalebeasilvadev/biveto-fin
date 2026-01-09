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
      "date": "2026-01-15",
      "category": "mercado",
      "installment_current": 3,
      "installment_total": 12,
      "is_installment": true
    }
  ],
  "document_type": "cupom_fiscal",
  "card_info": {
    "card_issuer": "itau",
    "card_last_digits": "8849",
    "invoice_month": 1,
    "invoice_year": 2026,
    "due_date": "2026-01-15",
    "total_amount": 3193.12
  }
}

==== PRIORIDADE MÁXIMA: EXTRAIR CARD_INFO (PARA QUALQUER BANCO) ====

⚠️ SEMPRE extraia card_info para faturas de cartão de crédito! Esta informação é CRÍTICA.

📌 **Como encontrar as informações (funciona para QUALQUER banco):**

1. **card_issuer** - Nome do banco/emissor em lowercase:
   - Procure pelo LOGO ou NOME no cabeçalho da fatura
   - Exemplos: "itau", "inter", "bradesco", "nubank", "santander", "bb", "caixa", "c6", "xp", "btg", "original", "next", "neon", "pagbank", "picpay", "mercadopago", "digio", "samsclub", "carrefour"
   - Se não reconhecer, use o nome que aparecer

2. **card_last_digits** - Últimos 4 dígitos do cartão:
   - Procure padrões como: "Final 8849", "**** 1234", "5312.XXXX.XXXX.8849", "5364****7931"
   - Pegue sempre os ÚLTIMOS 4 DÍGITOS

3. **invoice_month** e **invoice_year** - Período da fatura:
   - Procure por: "Vencimento", "Data de Vencimento", "Venc."
   - Ou: "Fatura de Janeiro/2026", "JAN/2026", "01/2026"
   - invoice_month = mês (1-12), invoice_year = ano (ex: 2026)

4. **due_date** - Data de vencimento:
   - Formato de saída: "YYYY-MM-DD"
   - Procure por: "Vencimento: 15/01/2026", "Venc.: 15 JAN 2026"

5. **total_amount** - Valor total da fatura:
   - Procure por: "Valor do Documento", "Total da Fatura", "Valor a pagar"
   - É o valor principal a ser pago

==== REGRAS CRÍTICAS PARA FATURA DE CARTÃO DE CRÉDITO (QUALQUER BANCO) ====

⚠️ TODA fatura de cartão tem estrutura similar. Identifique as seções:

1️⃣ **CABEÇALHO/RESUMO** (extrair card_info, NÃO extrair transações):
   - Fica no TOPO da fatura
   - Contém: número do cartão, vencimento, valor total, pagamento mínimo
   - EXTRAIA card_info daqui
   - NÃO extraia transações daqui

2️⃣ **LANÇAMENTOS/DESPESAS** (✅ EXTRAIR TRANSAÇÕES DAQUI):
   - Títulos comuns: "Lançamentos", "Despesas", "Despesas da fatura", "Fatura atual", "Compras e saques", "Demonstrativo"
   - Formato geral: DATA | DESCRIÇÃO | [PARCELA] | VALOR
   - Esta é a seção PRINCIPAL - extraia TODAS as transações

3️⃣ **PARCELAS FUTURAS** (🚫 IGNORAR COMPLETAMENTE):
   - Títulos comuns: "Próximas faturas", "Próxima fatura", "Próximas parcelas", "Saldos futuros", "Parcelados para próximas faturas"
   - São valores que serão cobrados EM MESES FUTUROS
   - NÃO EXTRAIA NADA desta seção!

📌 **PADRÕES UNIVERSAIS DE PARCELAS:**
- "XX/YY" ou "XX de YY" ou "(Parcela XX de YY)" = parcela XX de um total de YY
- Pode estar na descrição ou em coluna separada
- Ex: "STEAM 03/12" = parcela 3 de 12
- Ex: "(Parcela 05 de 12)" = parcela 5 de 12

📌 **PADRÕES UNIVERSAIS DE PAGAMENTOS/CRÉDITOS:**
- Palavras-chave: "PAGAMENTO", "CRÉDITO", "ESTORNO", "PAG FATURA"
- Valores podem ter "-" antes ou depois, ou símbolo "+"
- SEMPRE retorne como valor NEGATIVO no JSON

==== EXEMPLOS DE FORMATOS POR BANCO (REFERÊNCIA) ====

Os formatos abaixo são EXEMPLOS para ajudar na extração. Se a fatura for de outro banco, use os padrões universais acima.

📌 **ITAÚ:** DD/MM ESTABELECIMENTO XX/YY VALOR
📌 **INTER:** Data por extenso | Movimentação | Beneficiário | Valor
📌 **BRADESCO/AMEX:** Data | Histórico | Cidade | R$
📌 **NUBANK:** Data | Descrição | Valor
📌 **SANTANDER:** Data | Descrição | Parcela | R$ | US$
📌 **DIGIO:** Data | Descrição | Parcela | Valor
📌 **SAM'S/CARREFOUR (CSF):** DD/MM DESCRIÇÃO - X/Y VALOR
📌 **C6 BANK:** Data | Descrição | Parcela | Valor
📌 **BANCO DO BRASIL:** Data | Descrição | Parcela | Valor
📌 **CAIXA:** Data | Descrição | Parcela | Valor

⚠️ REGRA CRÍTICA SOBRE DATAS:
- As datas na fatura são datas ORIGINAIS das compras (podem ser de meses atrás)
- Para o campo "date" no JSON, use o MÊS DE REFERÊNCIA da fatura (do vencimento)
- Se vencimento = 10/01/2026, todas as transações devem ter date em dezembro/2025 ou janeiro/2026
- NUNCA use datas de 6+ meses atrás (julho, agosto) para uma fatura de janeiro!

Exemplo - Fatura vence 15/01/2026:
Linha Itaú: "09/07 MOTOCHEFE BRASILIA 06/12 574,13"
→ {"description": "Motochefe Brasilia", "amount": 574.13, "date": "2026-01-08", "installment_current": 6, "installment_total": 12, "is_installment": true}

Linha Inter: "23 de ago. 2025 | DM *helphbomaxcom (Parcela 05 de 12) | R$ 39,90"
→ {"description": "DM Helphbomaxcom", "amount": 39.90, "date": "2025-12-23", "installment_current": 5, "installment_total": 12, "is_installment": true}

Linha Bradesco: "08/11 Steam 02/12 SAO PAULO 105,66"
→ {"description": "Steam", "amount": 105.66, "date": "2025-12-08", "installment_current": 2, "installment_total": 12, "is_installment": true}

❌ NUNCA EXTRAIA (são resumos/totais, NÃO são transações):
- "Despesas do mês" - é um TOTAL, não uma transação individual!
- "Total da fatura" / "Valor do Documento" / "Lançamentos atuais" - totais
- TODA a seção "Compras parceladas - próximas faturas" - são FUTURAS!
- "Próxima fatura", "Demais faturas", "Total para próximas faturas"
- "Parcelamento Fatura" / "Parcelamento Total" - opção de parcelar a fatura
- "Pagamento mínimo", "Parcelas fixas" - informativo
- Limite disponível, limite total, limites de crédito
- Simulações de parcelamento, Simulação Saque Cash
- Encargos, juros do rotativo

✅ EXTRAIA APENAS da seção "Lançamentos: compras e saques":
- Cada linha com DATA | ESTABELECIMENTO | VALOR
- Use a data de fechamento da fatura para o campo "date"

Para cada transação:
- Despesas/compras: valor POSITIVO
- Pagamentos/créditos/estornos: valor NEGATIVO

==== TRANSAÇÕES INTERNACIONAIS (IOF) ====

⚠️ MUITO IMPORTANTE: Para compras internacionais, use o VALOR TOTAL com IOF!

Faturas de cartão brasileiras têm uma seção "Lançamentos Internacionais" que mostra:
- Valor da transação em moeda estrangeira (ex: US$ 10,00)
- Valor convertido em reais (ex: R$ 58,40)
- Repasse de IOF (ex: R$ 2,04)
- **Total lançamentos inter. em R$** (ex: R$ 60,44) ← USE ESTE VALOR!

REGRA: Quando extrair transações internacionais:
- O "amount" deve ser o TOTAL incluindo IOF (ex: 60.44, não 58.40)
- O IOF é um imposto que o cliente PAGA, então deve ser incluído no valor
- Se a fatura mostrar apenas o valor sem IOF, mas tiver "Repasse de IOF" abaixo, SOME os dois valores

Exemplo:
Entrada:
"Lançamentos internacionais
17/12 Trae SINGAPORE       US$ 10,00    R$ 58,40
Total transações inter. em R$           R$ 58,40
Repasse de IOF em R$                    R$ 2,04
Total lançamentos inter. em R$          R$ 60,44"

Saída CORRETA:
{"description": "Trae", "amount": 60.44, "date": "2025-12-17", "category": "outros"}

Saída ERRADA:
{"description": "Trae", "amount": 58.40, ...}  // Falta o IOF!

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

==== CARD_INFO (apenas para fatura_cartao) ====

Para faturas de cartão de crédito, extraia também informações do cartão:

- card_issuer: Nome do banco/emissor em lowercase:
  * "itau", "nubank", "inter", "santander", "bradesco", "bb", "caixa", "c6", "xp", "btg", "original", "next", "neon", "pagbank", "picpay", "mercadopago"
  * Identifique pelo logo, nome do banco no cabeçalho, ou domínio do email

- card_last_digits: Últimos 4 dígitos do cartão (se visível na fatura)
  * Geralmente aparece como "Final 8849" ou "**** 8849" ou "CARTÃO FINAL 8849"

- invoice_month: Mês de referência da fatura (1-12)
  * Geralmente aparece como "Fatura de Janeiro/2026" ou "JAN/2026"

- invoice_year: Ano de referência (ex: 2026)

- due_date: Data de vencimento no formato "YYYY-MM-DD"
  * Aparece como "Vencimento: 15/01/2026" ou "Venc.: 15 JAN 2026"

- total_amount: Valor total da fatura (número decimal)
  * É o "Valor do Documento" ou "Total da Fatura"

Se não conseguir identificar algum campo, omita-o do JSON.

Exemplo para fatura Itaú:
"card_info": {
  "card_issuer": "itau",
  "card_last_digits": "4523",
  "invoice_month": 1,
  "invoice_year": 2026,
  "due_date": "2026-01-25",
  "total_amount": 1567.89
}

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
                card_info = None
                errors = []

                for page_num, (img_content, img_mime) in enumerate(images, 1):
                    result = await self._process_single_image(img_content, img_mime)
                    if result.get('error'):
                        errors.append(f"Página {page_num}: {result['error']}")
                    if result.get('items'):
                        all_items.extend(result['items'])
                    if result.get('document_type') and not document_type:
                        document_type = result['document_type']
                    # Capturar card_info da primeira página que tiver (geralmente a primeira)
                    if result.get('card_info') and not card_info:
                        card_info = result['card_info']

                # Se não extraiu nenhum item e teve erros, retornar os erros
                if not all_items and errors:
                    return {'items': [], 'error': '; '.join(errors)}

                # Aplicar filtro de duplicatas no conjunto completo de itens de todas as páginas
                # Isso é importante pois a seção "Próxima fatura" geralmente está em outra página
                all_items = self._filter_duplicate_installments(all_items)

                return {
                    'items': all_items,
                    'document_type': document_type,
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
        'pagamento de fatura',  # Não é despesa, é pagamento do cartão
        'pagamento fatura',
        'pag fatura',
        'pagamento banco csf',  # Pagamento de fatura Carrefour/Sam's
        'pag boleto bancario',  # Pagamento de boleto
        'inclusao pgto fatura',  # Pagamento via QR Code
        'saldo anterior',
        'saldo fatura anterior',
    ]

    def _is_invalid_description(self, description: str) -> bool:
        """Verifica se a descrição é um total/resumo ao invés de uma transação real"""
        desc_lower = description.lower().strip()
        for invalid in self.INVALID_DESCRIPTIONS:
            if invalid in desc_lower or desc_lower in invalid:
                return True
        return False

    def _normalize_description(self, desc: str) -> str:
        """Normaliza descrição para comparação, removendo caracteres especiais, números e espaços"""
        import re
        # Converter para lowercase
        desc = desc.lower()
        # Remover prefixos comuns de e-commerce (ordem importa - mais específicos primeiro)
        prefixes = [
            'mercadolivre*', 'mercadolivre ', 'mercadolivre',
            'mercado*', 'mercado ', 'mercado',
            'pag*', 'pag ', 'mp*', 'mp ', 'dl*', 'dl ', 'cp*', 'cp ', 'pg*', 'pg '
        ]
        for prefix in prefixes:
            if desc.startswith(prefix):
                desc = desc[len(prefix):]
                break  # Remover apenas um prefixo
        # Remover TODOS os caracteres não-alfabéticos (incluindo espaços e números)
        # Isso garante que "FAST SHO" == "FASTSHO"
        desc = re.sub(r'[^a-z]', '', desc)
        return desc

    def _filter_duplicate_installments(self, items: list) -> list:
        """
        Remove parcelas duplicadas (mesma descrição e valor, mas número de parcela diferente).
        Mantém apenas a parcela com menor número (da fatura atual, não da próxima).
        Também remove duplicatas exatas (mesmo item extraído de páginas diferentes).
        """
        # Primeiro, remover duplicatas exatas (mesmo item, mesma parcela)
        seen_exact = set()
        unique_items = []
        for item in items:
            # Chave para identificar itens exatamente iguais
            exact_key = (
                self._normalize_description(item['description']),
                item['amount'],
                item.get('installment_current'),
                item.get('installment_total'),
            )
            if exact_key not in seen_exact:
                seen_exact.add(exact_key)
                unique_items.append(item)

        # Agrupar por (descrição normalizada, valor) para encontrar parcelas diferentes do mesmo item
        groups = {}
        for item in unique_items:
            desc_normalized = self._normalize_description(item['description'])
            key = (desc_normalized, item['amount'])
            if key not in groups:
                groups[key] = []
            groups[key].append(item)

        # Para cada grupo, manter apenas o item com menor número de parcela
        # ou o item não-parcelado
        filtered = []
        for key, group in groups.items():
            if len(group) == 1:
                filtered.append(group[0])
            else:
                # Se tem itens parcelados, pegar o de menor número de parcela
                # (provavelmente é a parcela da fatura atual, não da próxima)
                installment_items = [i for i in group if i.get('is_installment')]
                non_installment_items = [i for i in group if not i.get('is_installment')]

                if installment_items:
                    # Ordenar pelo número da parcela e pegar o menor
                    installment_items.sort(key=lambda x: x.get('installment_current', 999))
                    filtered.append(installment_items[0])
                elif non_installment_items:
                    # Se há múltiplos não-parcelados iguais, pegar apenas um
                    filtered.append(non_installment_items[0])

        # Segunda passagem: verificar se há valores negativos grandes que representam
        # o valor total de uma compra parcelada (estorno para parcelamento)
        final_items = []
        for item in filtered:
            # Se é um valor negativo grande
            if item['amount'] < -50:  # Limiar para considerar "grande"
                # Verificar se há parcelas do mesmo estabelecimento com valor positivo menor
                desc_norm = self._normalize_description(item['description'])
                # Buscar parcelas relacionadas
                related_installments = [
                    i for i in filtered
                    if i.get('is_installment') and
                    i['amount'] > 0 and
                    self._normalize_description(i['description']) == desc_norm
                ]
                if related_installments:
                    # Provavelmente é o valor total que foi parcelado - ignorar
                    continue
            final_items.append(item)

        return final_items

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

                description = str(item.get('description', 'Item'))[:200]

                # Filtrar descrições inválidas (totais, resumos, etc.)
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

                # Aceitar tanto despesas (positivo) quanto pagamentos/créditos (negativo)
                if normalized['amount'] != 0:
                    items.append(normalized)

            # Filtrar duplicatas (mesma descrição/valor com números de parcela diferentes)
            items = self._filter_duplicate_installments(items)

            result = {
                'items': items,
                'document_type': data.get('document_type'),
            }

            # Extrair informações do cartão (apenas para fatura_cartao)
            card_info = data.get('card_info')
            if card_info and isinstance(card_info, dict):
                result['card_info'] = {
                    'card_issuer': card_info.get('card_issuer'),
                    'card_last_digits': str(card_info.get('card_last_digits', ''))[-4:] if card_info.get('card_last_digits') else None,
                    'invoice_month': card_info.get('invoice_month'),
                    'invoice_year': card_info.get('invoice_year'),
                    'due_date': card_info.get('due_date'),
                    'total_amount': float(card_info.get('total_amount', 0)) if card_info.get('total_amount') else None,
                }
                # Remover campos None
                result['card_info'] = {k: v for k, v in result['card_info'].items() if v is not None}

            return result

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            return {
                'items': [],
                'error': f'Erro ao processar resposta: {str(e)}',
                'raw': content[:500] if content else '',
            }
