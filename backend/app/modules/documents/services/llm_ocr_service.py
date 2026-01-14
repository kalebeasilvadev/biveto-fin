"""Servico de extracao de dados usando LLM com visao (multi-provider)

Melhorias implementadas:
- Structured Output: Schema Pydantic para extracao consistente
- future_installments: Calcula parcelas futuras automaticamente
- Regra de consolidacao Santander: Extrai UMA parcela por grupo
- Validacao soma ≈ total_amount: Instruido no prompt
- API google-genai: SDK oficial com retry automatico
- Retry com exponential backoff: Para erros 503/429
"""
import asyncio
import base64
import json
import time
from typing import Optional
from pydantic import BaseModel, Field
from app.core.config import settings


# ============================================
# Schemas Pydantic para Structured Output
# ============================================

class FutureInstallment(BaseModel):
    """Parcela futura de um parcelamento."""
    installment: int = Field(description="Numero da parcela futura")
    reference_month: int = Field(description="Mes de referencia (1-12)")
    reference_year: int = Field(description="Ano de referencia")


class FaturaItem(BaseModel):
    """Item/transacao de uma fatura."""
    description: str = Field(description="Nome do estabelecimento ou descricao da transacao")
    amount: float = Field(description="Valor em reais. NEGATIVO para pagamentos, creditos e estornos")
    date: Optional[str] = Field(default=None, description="Data da transacao no formato YYYY-MM-DD")
    category: str = Field(
        description="Categoria: alimentacao, transporte, mercado, lazer, saude, moradia, "
                    "roupas, eletronicos, assinaturas, taxas, pagamento, credito, estorno, "
                    "saldo_anterior, outros"
    )
    transaction_type: str = Field(
        description="Tipo: compra (default), estorno, anuidade, pagamento, credito, encargo, saldo_anterior"
    )
    is_installment: bool = Field(default=False, description="Se e parcelado")
    installment_current: Optional[int] = Field(default=None, description="Parcela atual (ex: 3 de 3/12)")
    installment_total: Optional[int] = Field(default=None, description="Total de parcelas (ex: 12 de 3/12)")
    future_installments: Optional[list[FutureInstallment]] = Field(
        default=None,
        description="Parcelas futuras restantes. Apenas se is_installment=true"
    )


class CardInfo(BaseModel):
    """Informacoes do cartao de credito."""
    # Identificacao do cartao
    card_issuer: str = Field(description="Emissor/banco: nubank, itau, bradesco, santander, inter, bb, digio, carrefour, bradescard")
    card_bank: Optional[str] = Field(default=None, description="Banco emissor completo: Bradesco, Itau Unibanco, Banco do Brasil, etc.")
    card_brand: Optional[str] = Field(default=None, description="Bandeira: visa, mastercard, elo, hipercard, amex, diners")
    card_partner: Optional[str] = Field(default=None, description="Parceiro co-branded: amazon, smiles, latam, rappi, ifood, livelo")
    card_last_digits: Optional[str] = Field(default=None, description="Ultimos 4 digitos do cartao")
    card_name: Optional[str] = Field(default=None, description="Nome completo do cartao (ex: Bradesco Amazon Visa)")

    # Informacoes da fatura
    invoice_month: int = Field(description="Mes de referencia da fatura (1-12)")
    invoice_year: int = Field(description="Ano de referencia da fatura")
    closing_date: Optional[str] = Field(default=None, description="Data de fechamento YYYY-MM-DD")
    closing_day: Optional[int] = Field(default=None, description="Dia do fechamento (1-31)")
    due_date: str = Field(description="Data de vencimento YYYY-MM-DD")
    due_day: Optional[int] = Field(default=None, description="Dia do vencimento (1-31)")
    total_amount: float = Field(description="Valor TOTAL A PAGAR desta fatura")

    # Limites do cartao (se disponivel na fatura)
    credit_limit: Optional[float] = Field(default=None, description="Limite total do cartao")
    credit_used: Optional[float] = Field(default=None, description="Limite utilizado/comprometido")
    credit_available: Optional[float] = Field(default=None, description="Limite disponivel")


class FaturaExtracao(BaseModel):
    """Resultado da extracao de uma fatura de cartao."""
    document_type: str = Field(
        description="Tipo: fatura_cartao, cupom_fiscal, comprovante, extrato"
    )
    card_info: Optional[CardInfo] = Field(
        default=None,
        description="Informacoes do cartao. OBRIGATORIO se document_type=fatura_cartao"
    )
    items: list[FaturaItem] = Field(
        description="Lista de transacoes/itens extraidos"
    )


EXTRACTION_PROMPT = """# Extracao de Fatura de Cartao de Credito (Brasil)

Voce e um especialista em extrair dados de faturas de cartao de credito brasileiras.

## Sua Tarefa
Extraia TODOS os lancamentos da fatura e retorne no formato JSON especificado.

## Regras Criticas

### 1. Identificar card_info (DETALHADO)

#### 1.1 Identificacao do Cartao
- **card_issuer**: codigo do emissor (nubank, itau, bradesco, santander, inter, bb, digio, carrefour, bradescard)
  - BRADESCARD = cartoes Bradesco co-branded (Amazon, C&A, Casas Bahia)
- **card_bank**: nome completo do banco ("Bradesco", "Itau Unibanco", "Banco do Brasil", "Nubank")
- **card_brand**: bandeira do cartao
  - Procure por logos ou textos: VISA, MASTERCARD, ELO, HIPERCARD, AMEX, DINERS
  - Geralmente aparece no cabecalho ou rodape da fatura
- **card_partner**: parceiro co-branded (se houver)
  - Exemplos: amazon, smiles, latam, rappi, ifood, livelo, azul, gol
  - Identifique pelo nome do cartao ou logo na fatura
- **card_last_digits**: ultimos 4 digitos do cartao
- **card_name**: nome COMPLETO do cartao (ex: "Bradesco Amazon Visa", "Itau Platinum Mastercard")

#### 1.2 Informacoes da Fatura
- **total_amount**: valor do "Total a Pagar" ou "Saldo desta fatura" - este e o valor que o cliente deve pagar NESTE MES
- **due_date**: data de vencimento (formato YYYY-MM-DD)
- **due_day**: dia do vencimento (1-31)
- **closing_date**: data de fechamento (formato YYYY-MM-DD)
- **closing_day**: dia do fechamento (1-31)
- **invoice_month/year**: mes/ano de referencia da fatura (geralmente do vencimento)

#### 1.3 Limites do Cartao (se disponivel na fatura)
Muitas faturas mostram informacoes de limite. Procure por:
- **credit_limit**: "Limite Total", "Limite de Credito", "Limite do Cartao"
- **credit_used**: "Limite Utilizado", "Comprometido", "Em Uso"
- **credit_available**: "Limite Disponivel", "Disponivel para Compras"

**Exemplo de como aparece em faturas:**
```
Limite Total: R$ 10.000,00
Limite Utilizado: R$ 3.500,00
Limite Disponivel: R$ 6.500,00
```

### 2. Extrair Transacoes
Para cada linha de lancamento, extraia:
- description: nome do estabelecimento
- amount: valor em reais
- **date**: data da transacao no formato YYYY-MM-DD (OBRIGATORIO - veja secao 2.1)
- transaction_type: tipo do lancamento (ver abaixo)
- category: categoria (alimentacao, transporte, mercado, lazer, etc.)

### 2.1 DATAS DAS TRANSACOES (MUITO IMPORTANTE!)

**SEMPRE extraia a data de cada transacao!** A data e essencial para o controle financeiro.

**Formatos comuns em faturas brasileiras (DD = dia, MM = mes):**
- DD/MM ou DD/MM/AAAA (ex: 15/12, 15/12/2025)
- DD MMM (ex: 15 DEZ, 15 JAN)
- DD.MM.AAAA (ex: 15.12.2025)

**Onde encontrar a data:**
- Geralmente na PRIMEIRA coluna da linha da transacao
- Pode estar antes ou depois do nome do estabelecimento
- Em faturas Santander: formato DD/MM na coluna da esquerda
- Em faturas Nubank: formato DD MMM (ex: "15 DEZ")
- Em faturas Itau: formato DD/MM/AA

**REGRA CRITICA PARA O ANO (MUITO IMPORTANTE!):**
No Brasil, datas sao DD/MM (dia/mes), NAO MM/DD!
- "21/08" significa 21 de agosto, NAO 8 de agosto
- "15 DEZ" significa 15 de dezembro

**Como determinar o ano:**
1. Se a data tem ano (DD/MM/AAAA ou DD/MM/AA): use o ano informado
2. Se a data NAO tem ano (DD/MM ou DD MMM): use o ano da fatura (invoice_year)
3. EXCECAO: Se o mes da transacao > mes da fatura, use invoice_year - 1
   - Exemplo: transacao "28/12" numa fatura de Jan/2026 → 2025-12-28
   - Exemplo: transacao "15 DEZ" numa fatura de Jan/2026 → 2025-12-15
   - Exemplo: transacao "21/08" numa fatura de Jan/2026 → 2025-08-21 (NÃO 2021!)

**NUNCA use anos muito antigos (2021, 2022, 2023) para faturas recentes!**
Se a fatura e de 2025/2026, as transacoes sao de 2025 ou 2026, NUNCA de 2021/2022.

**Formato de saida:** SEMPRE YYYY-MM-DD (ex: "2025-12-15")

### 3. Tipos de Transacao (transaction_type)
- **compra**: compras normais (DEFAULT para valores POSITIVOS)
- **pagamento**: pagamento de fatura anterior → amount NEGATIVO
  - Identificar por: "PAGAMENTO DE FATURA", "PAG FATURA", "PGTO COBRANCA"
  - **NUBANK**: "Pagamento em DD MMM" (ex: "Pagamento em 08 DEZ") = PAGAMENTO com valor NEGATIVO
  - **ITAU/BRADESCO**: "PAGAMENTO EFETUADO", "PGTO DEBITO AUTOMATICO" = PAGAMENTO
  - CUIDADO: Se "PAGAMENTO" esta no NOME DO ESTABELECIMENTO (ex: "PRIME GLOBAL PAGAMENTO") e valor e POSITIVO, e COMPRA!
- **credito**: creditos, cashback → amount NEGATIVO
- **estorno**: devolucoes, cancelamentos → amount NEGATIVO
- **anuidade**: "ANUIDADE", "TARIFA ANUAL"
- **encargo**: juros, multa, IOF, taxas
- **saldo_anterior**: "SALDO FATURA ANTERIOR"

**REGRA FUNDAMENTAL**: Se o valor e POSITIVO, provavelmente e compra (nao pagamento)!

**DETECCAO DE PAGAMENTOS (CRITICO!):**
Pagamentos de fatura anterior SEMPRE tem valor NEGATIVO porque REDUZEM o saldo devedor.
- Se voce ver "Pagamento em 08 DEZ" com valor R$ 2.198,18 → deve ser amount: -2198.18
- Pagamentos aparecem como CREDITO na fatura (diminuem o que voce deve)
- NAO confunda pagamento da fatura com compras em estabelecimentos que tem "pagamento" no nome

### 3.1 IOF (Imposto sobre Operacoes Financeiras)
- Compras internacionais incluem IOF
- O IOF aparece como linha SEPARADA apos a compra (ex: "IOF COMPRA INT" ou junto ao valor)
- Extraia o IOF como item separado com transaction_type: "encargo"
- Se o IOF estiver na mesma linha da compra (ex: "COMPRA R$ 58,40 + IOF R$ 2,04"):
  - Extraia 2 itens: a compra (R$ 58,40) e o IOF (R$ 2,04)
- Descricao comum: "IOF", "IOF DE", "IMPOSTO"

### 3.2 Estornos e Cancelamentos (CRITICO!)

**REGRA PRINCIPAL**: Compras CANCELADAS nao devem ser extraidas!

Quando uma compra parcelada e CANCELADA, o PDF mostra:
1. TODAS as parcelas da compra (01/12, 02/12... 12/12) com valores positivos
2. Um ESTORNO grande com valor negativo ≈ soma de todas as parcelas

**EXEMPLO SANTANDER**:
```
03/12  MERCADO*GOBLINFACTORY  01/12  R$ 107,55
03/12  MERCADO*GOBLINFACTORY  02/12  R$ 107,49
... (ate 12/12, total ~R$ 1.289,94)
[em outra secao]
       MERCADO*GOBLINFACTORY         -R$ 1.289,94  ← estorno
```

**COMO IDENTIFICAR E TRATAR**:
1. Agrupe parcelas consecutivas (regra 4.2) → valor_total = 107.55 + 11*107.49 = ~1289.94
2. Procure estorno com valor ≈ -1289.94
3. Se encontrar: NAO extraia nem a compra nem o estorno!

**ESTORNOS SIMPLES** (compra nao-parcelada):
```
LOJA X        R$ 50,00   (compra)
ESTORNO LOJA X  -R$ 50,00   (estorno)
```
→ NAO extraia nenhum dos dois

**ESTORNOS PEQUENOS** (cashback, ajustes):
```
MERCADOLIVRE*MERCADOL  -R$ 0,02
```
→ EXTRAIA como credito (valor muito pequeno, nao e cancelamento)

### 3.3 FORMATO BRADESCO (CRITICO!)

Faturas Bradesco (incluindo AMEX, Visa, Mastercard, Elo, Bradescard) tem um formato especifico que voce DEVE seguir:

**Layout da tabela:**
```
Data  Histórico de Lançamentos           Cidade       US$  Cotação  R$
08/12 PAG BOLETO BANCARIO                             1.513,17 -
02/11 TELLERINA COMERCIO D02/03          BRASILIA              126,66
03/11 HOTMART asimovacadem02/12          BH                    167,01
08/11 Steam 02/12                        SAO PAULO             105,66
14/12 DAISO JAPAN                        BRASILIA              371,80
```

**REGRAS IMPORTANTES:**

1. **O valor R$ esta SEMPRE na ULTIMA coluna** - nao confunda com outras colunas!
2. **A parcela esta CONCATENADA na descricao** - ex: "Steam 02/12" significa Steam parcela 02/12
3. **NAO limpe a descricao** - mantenha "Steam 02/12" exatamente assim (nao remova o 02/12)
4. **Pagamentos tem "-" apos o valor** - ex: "1.513,17 -" significa -1513.17 (valor NEGATIVO)
5. **"PAG BOLETO BANCARIO"** = pagamento de fatura anterior (amount NEGATIVO)
6. **Extraia TODAS as linhas** - incluindo itens sem parcela como "DAISO JAPAN"

**ERROS COMUNS - NAO COMETA:**
- NAO troque valores entre linhas diferentes
- NAO pule linhas da tabela
- NAO remova o sufixo de parcela (02/12, 01/05, etc.) da descricao
- NAO confunda o valor de uma linha com outra

**EXEMPLO DE EXTRACAO CORRETA:**
```json
{"description": "Steam 02/12", "amount": 105.66, "date": "2025-11-08", "is_installment": true, "installment_current": 2, "installment_total": 12}
{"description": "DAISO JAPAN", "amount": 371.80, "date": "2025-12-14", "is_installment": false}
{"description": "PAG BOLETO BANCARIO", "amount": -1513.17, "transaction_type": "pagamento"}
```

### 4. REGRA CRITICA: Parcelas (MUITO IMPORTANTE!)

#### 4.1 Formato de Parcelas nas Faturas

**FORMATO SANTANDER/ITAU/BRADESCO (coluna separada):**

O Santander tem uma tabela com COLUNAS SEPARADAS. Veja o layout EXATO:

```
Parcelamentos
Compra  Data   Descricao                    Parcela   R$     US$
        04/12  MERCADOLIVRE*4PRODUTOS       01/12     16,91
        04/12  MERCADOLIVRE*4PRODUTOS       01/12     20,87
        16/11  MERCADOLIVRE*LGELECTR        14/21     172,88
        17/11  MERCADOLIVRE*HABBITSH        02/06     56,15
```

**INTERPRETACAO DAS COLUNAS:**
- Coluna "Data" (ex: 04/12, 16/11) = DATA da compra (dia/mes)
- Coluna "Parcela" (ex: 01/12, 14/21, 02/06) = informacao de parcelamento

**COMO LER A COLUNA "Parcela":**
- "01/12" na coluna Parcela = parcela 1 de 12 → installment_current=1, installment_total=12
- "14/21" na coluna Parcela = parcela 14 de 21 → installment_current=14, installment_total=21
- "02/06" na coluna Parcela = parcela 2 de 6 → installment_current=2, installment_total=6

**ERRO COMUM - NAO COMETA:**
- ERRADO: Ver "01/12" na coluna Parcela e extrair installment_total=1
- CORRETO: Ver "01/12" na coluna Parcela e extrair installment_current=1, installment_total=12

A coluna "Parcela" SEMPRE usa formato "atual/total". O numero DEPOIS da barra e o TOTAL de parcelas!

**FORMATO NUBANK (na descricao):**
```
15 DEZ  LOJA ABC 2/6  R$ 50,00
```
- "2/6" junto a descricao = parcela 2 de 6

#### 4.2 Parcelas Consecutivas do MESMO Estabelecimento (AGRUPAR!)

**PROBLEMA COMUM**: Santander mostra TODAS as parcelas de uma compra na mesma fatura.

**EXEMPLO** - PDF mostra:
```
03/12  MERCADO*GOBLINFACTORY  01/12  R$ 107,55
03/12  MERCADO*GOBLINFACTORY  02/12  R$ 107,49
03/12  MERCADO*GOBLINFACTORY  03/12  R$ 107,49
... (ate 12/12)
```

**REGRA DE AGRUPAMENTO**: Se voce encontrar:
- MESMO estabelecimento (descricao igual ou muito similar)
- MESMA data de compra
- Valores IGUAIS ou muito proximos
- Parcelas SEQUENCIAIS (01/12, 02/12, 03/12...)

→ **EXTRAIA APENAS 1 ITEM** usando a PRIMEIRA parcela!
   - installment_current = 1 (a primeira do grupo)
   - installment_total = 12 (o total de parcelas)
   - amount = valor da primeira parcela (ex: 107.55)

**NO EXEMPLO ACIMA**: Extrair apenas:
```json
{
  "description": "MERCADO*GOBLINFACTORY",
  "amount": 107.55,
  "installment_current": 1,
  "installment_total": 12
}
```
NAO extrair 12 itens separados!

**PARCELAS NAO-SEQUENCIAIS**: Se aparecer apenas UMA parcela (ex: 14/21), extraia normalmente:
```
16/11  MERCADOLIVRE*LGELECTR  14/21  R$ 172,88
```
→ installment_current=14, installment_total=21

### 5. Validacao
A soma de todos os itens com transaction_type em {compra, anuidade, encargo} DEVE ser aproximadamente igual ao total_amount.

Se a soma for muito maior que o total_amount, voce esta extraindo parcelas futuras como itens separados - CORRIJA!

### 6. Pagamentos e Creditos
- SEMPRE inclua pagamentos e creditos na lista de items
- Pagamentos sao valores NEGATIVOS (ex: -1500.00)
- Eles NAO entram no calculo do total_amount

## Exemplo de Saida

```json
{
  "document_type": "fatura_cartao",
  "card_info": {
    "card_issuer": "bradescard",
    "card_bank": "Bradesco",
    "card_brand": "visa",
    "card_partner": "amazon",
    "card_last_digits": "1234",
    "card_name": "Bradesco Amazon Visa",
    "invoice_month": 1,
    "invoice_year": 2026,
    "closing_date": "2026-01-05",
    "closing_day": 5,
    "due_date": "2026-01-15",
    "due_day": 15,
    "total_amount": 1500.00,
    "credit_limit": 10000.00,
    "credit_used": 3500.00,
    "credit_available": 6500.00
  },
  "items": [
    {
      "description": "RESTAURANTE X",
      "amount": 50.00,
      "date": "2025-12-20",
      "category": "alimentacao",
      "transaction_type": "compra",
      "is_installment": false
    },
    {
      "description": "LOJA Y",
      "amount": 100.00,
      "date": "2025-12-15",
      "category": "mercado",
      "transaction_type": "compra",
      "is_installment": true,
      "installment_current": 1,
      "installment_total": 10,
      "future_installments": [
        {"installment": 2, "reference_month": 2, "reference_year": 2026},
        {"installment": 3, "reference_month": 3, "reference_year": 2026}
      ]
    },
    {
      "description": "PAGAMENTO FATURA",
      "amount": -1200.00,
      "date": "2026-01-05",
      "category": "pagamento",
      "transaction_type": "pagamento",
      "is_installment": false
    }
  ]
}
```

## Extraia agora os dados desta fatura:
"""


# Configuracao de retry
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 2.0  # segundos


class LLMOCRService:
    """Extrai dados de imagens usando LLM com visao (suporta multiplos providers)"""

    def __init__(self):
        self.provider = settings.vision_provider
        self.model = settings.vision_model or 'gemini-2.5-flash-lite'
        self.max_retries = DEFAULT_MAX_RETRIES
        self.retry_delay = DEFAULT_RETRY_DELAY
        self._google_client = None
        print(f"[LLM_OCR] Initialized: provider={self.provider}, model={self.model}")

    def _get_google_client(self):
        """Obtem cliente Google Genai (lazy initialization)"""
        if self._google_client is None:
            try:
                from google import genai
                api_key = settings.google_api_key
                if not api_key:
                    raise ValueError("GOOGLE_API_KEY nao configurada")
                self._google_client = genai.Client(api_key=api_key)
            except ImportError:
                raise ImportError("google-genai nao instalado. Execute: pip install google-genai")
        return self._google_client

    def _convert_pdf_to_images(self, pdf_content: bytes) -> tuple[list[tuple[bytes, str]], str | None]:
        """Converte PDF para lista de imagens (uma por pagina)

        Returns:
            Tuple of (images list, error message or None)
        """
        try:
            import fitz  # pymupdf

            images = []
            pdf_doc = fitz.open(stream=pdf_content, filetype="pdf")

            if len(pdf_doc) == 0:
                pdf_doc.close()
                return [], "PDF nao contem paginas"

            for page_num in range(len(pdf_doc)):
                page = pdf_doc[page_num]
                # Renderizar pagina como imagem com boa resolucao
                mat = fitz.Matrix(2.0, 2.0)  # 2x zoom para melhor qualidade
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                images.append((img_bytes, 'image/png'))

            pdf_doc.close()
            return images, None
        except ImportError as e:
            return [], f"PyMuPDF nao instalado: {e}"
        except Exception as e:
            return [], f"Erro ao converter PDF: {e}"

    def _is_retryable_error(self, error: Exception) -> bool:
        """Verifica se o erro e retryable (503, 429, etc.)"""
        error_str = str(error).lower()
        return any(code in error_str for code in ["503", "429", "unavailable", "overloaded", "rate limit", "resource_exhausted"])

    async def _process_pdf_as_images(self, pdf_content: bytes) -> dict:
        """Fallback: converte PDF para imagens e processa"""
        images, pdf_error = self._convert_pdf_to_images(pdf_content)
        if pdf_error:
            return {'items': [], 'error': pdf_error}
        if not images:
            return {'items': [], 'error': 'PDF nao gerou imagens para processar'}

        # Se temos multiplas paginas e estamos usando Google, enviar todas juntas
        if len(images) > 1 and self.provider == 'google':
            return await self._call_google_multi_page(images)
        else:
            # Processar paginas separadamente
            all_items = []
            document_type = None
            card_info = None
            errors = []

            for page_num, (img_content, img_mime) in enumerate(images, 1):
                page_result = await self._process_single_image(img_content, img_mime)
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

    async def extract_from_image(self, image_content: bytes, mime_type: str = 'image/png') -> dict:
        """Extrai dados da imagem usando o provider configurado"""
        print(f"[LLM_OCR] extract_from_image: mime_type={mime_type}, content_size={len(image_content)}")
        try:
            is_pdf = mime_type == 'application/pdf' or mime_type.endswith('/pdf')

            # 1. Extrair dados do documento
            if is_pdf and self.provider == 'google':
                # PDF + Google: usar upload direto (como agentes_faturas)
                print("[LLM_OCR] Processing PDF via upload (agentes_faturas method)")
                result = await self._call_google_pdf_upload(image_content)

                # Se falhou, usar fallback de conversao para imagens
                if result is None or result.get('error'):
                    if result and result.get('error'):
                        print(f"[LLM_OCR] PDF upload failed: {result.get('error')}, trying image fallback")
                    else:
                        print("[LLM_OCR] PDF upload not available, falling back to image conversion")
                    result = await self._process_pdf_as_images(image_content)

                # Validar extração - se diferença > 20%, tentar com imagens
                if result and not result.get('error'):
                    validation = self._validate_extraction(result.get('items', []), result.get('card_info'))
                    if not validation.get('is_valid') and abs(validation.get('difference', 0)) > 200:
                        print(f"[LLM_OCR] Extraction validation failed (diff={validation.get('difference'):.2f}), retrying with image conversion...")
                        result_images = await self._process_pdf_as_images(image_content)
                        if result_images and not result_images.get('error'):
                            validation_images = self._validate_extraction(result_images.get('items', []), result_images.get('card_info'))
                            # Usar resultado de imagens se for melhor
                            if abs(validation_images.get('difference', 999999)) < abs(validation.get('difference', 0)):
                                print(f"[LLM_OCR] Image conversion gave better result (diff={validation_images.get('difference'):.2f})")
                                result = result_images

            elif is_pdf:
                # PDF + outros providers: converter para imagens
                print("[LLM_OCR] Processing PDF via image conversion (non-Google provider)")
                result = await self._process_pdf_as_images(image_content)

            else:
                # Imagem: processar diretamente
                result = await self._process_single_image(image_content, mime_type)

            # 2. Se houve erro na extracao, retornar
            if result.get('error'):
                return result

            # 3. Aplicar filtros pos-processamento (seguindo extractor_v2)
            all_items = result.get('items', [])
            card_info = result.get('card_info')

            print(f"[LLM_OCR] Extraction result: {len(all_items)} items before filters")

            # Corrigir convenção invertida de sinais (alguns emissores como Celebre/PEFISA)
            all_items = self._fix_inverted_sign_convention(all_items, card_info)

            # Corrigir parcelamentos Bradesco AMEX (info concatenada na descrição)
            all_items = self._fix_bradesco_installments(all_items, card_info)

            # Corrigir pagamentos que vieram com valor positivo
            all_items = self._fix_payment_amounts(all_items)

            # Detectar parcelas 1/1 suspeitas (debug)
            all_items = self._fix_suspicious_installments(all_items)

            # Remover parcelas consecutivas duplicadas (Santander mostra todas as parcelas)
            all_items = self._filter_consecutive_installments(all_items)

            # Remover compras canceladas (tem estorno correspondente)
            all_items = self._remove_cancelled_purchases(all_items, card_info)

            # Remover itens que são totais/resumos (valor = total_amount)
            all_items = self._remove_total_items(all_items, card_info)

            # Tentar corrigir validacao removendo compras canceladas (sem estorno explicito)
            all_items = self._try_fix_validation_by_removing_purchases(all_items, card_info)

            # Validar extracao
            validation = self._validate_extraction(all_items, card_info)
            if not validation['is_valid']:
                print(f"[LLM_OCR] Validation warning: diff={validation['difference']:.2f}")

            print(f"[LLM_OCR] Final result: {len(all_items)} items after filters")

            return {
                'items': all_items,
                'document_type': result.get('document_type'),
                'card_info': card_info,
                '_validation': validation,
            }

        except Exception as e:
            import traceback
            print(f"[LLM_OCR] Unexpected error: {e}")
            traceback.print_exc()
            return {'items': [], 'error': f'Erro inesperado: {str(e)}'}

    async def _process_single_image(self, image_content: bytes, mime_type: str) -> dict:
        """Processa uma unica imagem"""
        try:
            if self.provider == 'google':
                return await self._call_google(image_content, mime_type)
            elif self.provider == 'openai':
                return await self._call_openai(image_content, mime_type)
            elif self.provider == 'anthropic':
                return await self._call_anthropic(image_content, mime_type)
            else:
                return {'items': [], 'error': f'Provider nao suportado: {self.provider}'}
        except Exception as e:
            return {'items': [], 'error': str(e)}

    async def _call_google(self, image_content: bytes, mime_type: str) -> dict:
        """Chama Google Gemini API usando SDK oficial com retry"""
        try:
            from google.genai import types
        except ImportError:
            # Fallback para httpx se google-genai nao estiver instalado
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

        return {'items': [], 'error': f'Falha apos {self.max_retries} tentativas: {last_error}'}

    async def _call_google_pdf_upload(self, pdf_content: bytes) -> dict:
        """
        Processa PDF via upload para o Gemini (como agentes_faturas).

        O Gemini processa PDFs nativamente com muito mais qualidade
        do que converter para imagens.
        """
        try:
            from google.genai import types
            import tempfile
            import os
        except ImportError:
            print("[LLM_OCR] google.genai not available, falling back to image conversion")
            return None  # Sinaliza para usar fallback

        client = self._get_google_client()
        print(f"[LLM_OCR] Using PDF upload method (like agentes_faturas), model={self.model}")

        # Salvar PDF em arquivo temporario para upload
        temp_file = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
                f.write(pdf_content)
                temp_file = f.name

            # Upload do PDF para o Gemini
            print(f"[LLM_OCR] Uploading PDF to Gemini...")
            uploaded_file = client.files.upload(
                file=temp_file,
                config={"mime_type": "application/pdf"},
            )
            print(f"[LLM_OCR] PDF uploaded: uri={uploaded_file.uri}")

            last_error = None
            for attempt in range(self.max_retries):
                try:
                    print(f"[LLM_OCR] Calling Gemini API with PDF upload (attempt {attempt + 1}/{self.max_retries})...")
                    response = client.models.generate_content(
                        model=self.model,
                        contents=[
                            types.Part.from_uri(
                                file_uri=uploaded_file.uri,
                                mime_type=uploaded_file.mime_type,
                            ),
                            EXTRACTION_PROMPT,
                        ],
                        config=types.GenerateContentConfig(
                            temperature=0.1,
                            response_mime_type="application/json",
                            response_schema=FaturaExtracao,
                        ),
                    )

                    response_text = response.text if response else ""
                    print(f"[LLM_OCR] Gemini response length: {len(response_text)} chars")

                    return self._parse_response(response_text)

                except Exception as e:
                    last_error = e
                    print(f"[LLM_OCR] Gemini API error (attempt {attempt + 1}): {type(e).__name__}: {e}")
                    if self._is_retryable_error(e) and attempt < self.max_retries - 1:
                        wait_time = self.retry_delay * (2 ** attempt)
                        print(f"[LLM_OCR] Retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        raise

            return {'items': [], 'error': f'Falha apos {self.max_retries} tentativas: {last_error}'}

        finally:
            # Limpar arquivo temporario
            if temp_file and os.path.exists(temp_file):
                os.unlink(temp_file)

    async def _call_google_multi_page(self, images: list[tuple[bytes, str]]) -> dict:
        """Chama Google Gemini API com multiplas paginas usando SDK oficial"""
        try:
            from google.genai import types
        except ImportError:
            # Fallback para httpx
            print("[LLM_OCR] google.genai not available, using httpx fallback")
            return await self._call_google_multi_page_httpx(images)

        client = self._get_google_client()
        print(f"[LLM_OCR] Using Google SDK, model={self.model}")

        # Construir partes da mensagem: prompt + todas as imagens
        parts = [EXTRACTION_PROMPT + "\n\n⚠️ ATENCAO: Este documento tem MULTIPLAS PAGINAS. Extraia TODAS as transacoes de TODAS as paginas!"]

        for i, (img_content, img_mime) in enumerate(images):
            parts.append(types.Part.from_bytes(data=img_content, mime_type=img_mime))
            parts.append(f'[Pagina {i+1} de {len(images)}]')

        last_error = None
        for attempt in range(self.max_retries):
            try:
                print(f"[LLM_OCR] Calling Gemini API with Structured Output (attempt {attempt + 1}/{self.max_retries})...")
                response = client.models.generate_content(
                    model=self.model,
                    contents=parts,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        response_mime_type="application/json",
                        response_schema=FaturaExtracao,  # Structured Output!
                    ),
                )

                response_text = response.text if response else ""
                print(f"[LLM_OCR] Gemini response length: {len(response_text)} chars")
                if len(response_text) < 500:
                    print(f"[LLM_OCR] Gemini raw response: {response_text[:500]}")
                else:
                    print(f"[LLM_OCR] Gemini response preview: {response_text[:200]}...")

                return self._parse_response(response_text)

            except Exception as e:
                last_error = e
                print(f"[LLM_OCR] Gemini API error (attempt {attempt + 1}): {type(e).__name__}: {e}")
                if self._is_retryable_error(e) and attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2 ** attempt)
                    print(f"[LLM_OCR] Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    print(f"[LLM_OCR] Not retrying, raising exception")
                    raise

        return {'items': [], 'error': f'Falha apos {self.max_retries} tentativas: {last_error}'}

    async def _call_google_httpx(self, image_content: bytes, mime_type: str) -> dict:
        """Fallback: Chama Google Gemini API via httpx (se SDK nao disponivel)"""
        import httpx

        api_key = settings.google_api_key
        if not api_key:
            return {'items': [], 'error': 'GOOGLE_API_KEY nao configurada'}

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

        return {'items': [], 'error': f'Falha apos {self.max_retries} tentativas: {last_error}'}

    async def _call_google_multi_page_httpx(self, images: list[tuple[bytes, str]]) -> dict:
        """Fallback: Chama Google Gemini API com multiplas paginas via httpx"""
        import httpx

        api_key = settings.google_api_key
        if not api_key:
            return {'items': [], 'error': 'GOOGLE_API_KEY nao configurada'}

        parts = [{'text': EXTRACTION_PROMPT + "\n\n⚠️ ATENCAO: Este documento tem MULTIPLAS PAGINAS. Extraia TODAS as transacoes de TODAS as paginas!"}]

        for i, (img_content, img_mime) in enumerate(images):
            image_base64 = base64.b64encode(img_content).decode('utf-8')
            parts.append({
                'inline_data': {
                    'mime_type': img_mime,
                    'data': image_base64,
                }
            })
            parts.append({'text': f'[Pagina {i+1} de {len(images)}]'})

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

        return {'items': [], 'error': f'Falha apos {self.max_retries} tentativas: {last_error}'}

    async def _call_openai(self, image_content: bytes, mime_type: str) -> dict:
        """Chama OpenAI API"""
        import httpx

        api_key = settings.openai_api_key
        if not api_key:
            return {'items': [], 'error': 'OPENAI_API_KEY nao configurada'}

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
            return {'items': [], 'error': 'ANTHROPIC_API_KEY nao configurada'}

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

    # Padroes de descricao que indicam totais/resumos (nao sao transacoes reais)
    INVALID_DESCRIPTIONS = [
        'despesas do mes',
        'fatura atual',
        'total da fatura',
        'total da fatura em real',
        'total para ',  # "Total para KALEBE ANDRADE SILVA"
        'valor do documento',
        'pagamento minimo',
        'parcelamento fatura',
        'parcelamento total',
        'limite disponivel',
        'limite total',
        'proxima fatura',
        'proximas parcelas',
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
        """Verifica se a descricao e um total/resumo ao inves de uma transacao real"""
        desc_lower = description.lower().strip()

        # Verificar padrões de descrições inválidas
        for invalid in self.INVALID_DESCRIPTIONS:
            if invalid in desc_lower or desc_lower in invalid:
                return True

        # Padrões específicos com regex
        import re

        # "Total para NOME" ou "Total NOME"
        if re.match(r'^total\s+(para\s+)?[a-z\s]+$', desc_lower):
            return True

        # "Total da fatura em real" ou similar
        if 'total' in desc_lower and ('fatura' in desc_lower or 'real' in desc_lower):
            return True

        return False

    # Padroes que indicam pagamento de fatura (deve ter valor NEGATIVO)
    PAYMENT_PATTERNS = [
        'pagamento em ',  # Nubank: "Pagamento em 08 DEZ"
        'pagamento de fatura',
        'pag fatura',
        'pgto fatura',
        'pgto cobranca',
        'pagamento efetuado',
        'pgto debito automatico',
        'pagamento recebido',
        'credito pagamento',
    ]

    def _fix_payment_amounts(self, items: list) -> list:
        """
        Corrige pagamentos que vieram com valor positivo.

        Pagamentos de fatura devem SEMPRE ter valor negativo pois
        reduzem o saldo devedor.
        """
        for item in items:
            desc_lower = item.get('description', '').lower()
            amount = item.get('amount', 0)

            # Verificar se e um pagamento pelo padrao da descricao
            is_payment_pattern = any(pattern in desc_lower for pattern in self.PAYMENT_PATTERNS)

            # Verificar se e pagamento pelo transaction_type
            is_payment_type = item.get('transaction_type') == 'pagamento'

            # Se e pagamento mas valor e positivo, corrigir
            if (is_payment_pattern or is_payment_type) and amount > 0:
                # Verificar se NAO e um estabelecimento com "pagamento" no nome
                # Ex: "PRIME GLOBAL PAGAMENTO" e uma compra, nao um pagamento
                is_likely_merchant = any(word in desc_lower for word in [
                    'prime', 'global', 'servicos', 'comercio', 'ltda', 'eireli', 'me ', ' sa'
                ])

                if not is_likely_merchant:
                    print(f"[LLM_OCR] Fixing payment amount: '{item['description']}' {amount} -> {-amount}")
                    item['amount'] = -amount
                    item['transaction_type'] = 'pagamento'
                    item['category'] = 'pagamento'

        return items

    def _fix_inverted_sign_convention(self, items: list, card_info: dict | None) -> list:
        """
        Corrige emissores que usam convenção invertida de sinais.

        Alguns emissores (como Celebre/Leroy Merlin, PEFISA) usam:
        - Débitos (compras): valores NEGATIVOS
        - Créditos (pagamentos): valores POSITIVOS

        O sistema espera:
        - Compras: valores POSITIVOS
        - Pagamentos: valores NEGATIVOS

        Esta função detecta e corrige essa inversão.
        """
        if not items:
            return items

        # Lista de emissores conhecidos com convenção invertida
        INVERTED_ISSUERS = ['leroymerlin', 'celebre', 'pefisa', 'bradescard']

        card_issuer = (card_info.get('card_issuer') or '').lower() if card_info else ''

        # Detectar se é um emissor conhecido com convenção invertida
        is_known_inverted = any(issuer in card_issuer for issuer in INVERTED_ISSUERS)

        # Detecção automática: contar quantas compras têm valor negativo
        compras = [i for i in items if i.get('transaction_type') in ('compra', 'anuidade', 'encargo')]
        pagamentos = [i for i in items if i.get('transaction_type') == 'pagamento']

        compras_negativas = sum(1 for c in compras if c.get('amount', 0) < 0)
        pagamentos_positivos = sum(1 for p in pagamentos if p.get('amount', 0) > 0)

        # Se a maioria das compras é negativa E tem algum pagamento positivo, convenção está invertida
        auto_detect_inverted = (
            len(compras) > 0 and
            compras_negativas / len(compras) > 0.7 and  # Mais de 70% das compras são negativas
            pagamentos_positivos > 0  # Existe pagamento com valor positivo
        )

        if is_known_inverted or auto_detect_inverted:
            reason = f"emissor conhecido ({card_issuer})" if is_known_inverted else "detecção automática"
            print(f"[LLM_OCR] Convenção de sinais invertida detectada ({reason}). Corrigindo...")

            for item in items:
                amount = item.get('amount', 0)
                if amount != 0:
                    item['amount'] = -amount
                    print(f"[LLM_OCR] Invertendo: '{item.get('description', '')[:30]}' {amount} -> {-amount}")

        return items

    def _fix_bradesco_installments(self, items: list, card_info: dict | None) -> list:
        """
        Corrige parcelamentos em faturas Bradesco/AMEX onde a informação de parcela
        está concatenada à descrição.

        Formato Bradesco AMEX:
        - "TELLERINA COMERCIO D02/03" → parcela 02/03
        - "HOTMART asimovacadem02/12" → parcela 02/12
        - "CIATOY BRINQUEDOS LT02/10" → parcela 02/10
        - "Steam 02/12" → parcela 02/12
        - "EC *ANARHU00125101/02" → parcela 01/02

        O padrão é: descrição + [letras opcionais] + XX/YY (no final)
        """
        import re

        if not items:
            return items

        # Detectar se é Bradesco (qualquer variante: AMEX, Visa, Mastercard, Elo, Bradescard)
        card_issuer = (card_info.get('card_issuer') or '').lower() if card_info else ''
        card_name = (card_info.get('card_name') or '').lower() if card_info else ''
        card_bank = (card_info.get('card_bank') or '').lower() if card_info else ''

        is_bradesco = (
            'bradesco' in card_issuer or
            'bradesco' in card_name or
            'bradesco' in card_bank or
            'bradescard' in card_issuer or
            'bradescard' in card_name
        )

        if not is_bradesco:
            return items

        print(f"[LLM_OCR] Detectado Bradesco, verificando parcelamentos concatenados...")

        # Padrão para extrair NN/NN no final (com ou sem prefixo)
        # Captura: qualquer coisa + (digitos 1-2)/(digitos 1-2) no final
        pattern = re.compile(r'(\d{1,2})/(\d{1,2})$')

        fixed_count = 0
        for item in items:
            # Pular se já tem informação de parcela válida
            if item.get('is_installment') and item.get('installment_current') and item.get('installment_total'):
                if item.get('installment_total', 0) > 1:  # Já tem info válida
                    continue

            # Pular pagamentos, estornos, etc.
            if item.get('transaction_type') not in ['compra', None]:
                continue

            description = item.get('description', '')
            match = pattern.search(description)

            if match:
                current = int(match.group(1))
                total = int(match.group(2))

                # Validar: parcela deve ser <= total e valores razoáveis
                if 1 <= current <= total <= 48:
                    # Limpar descrição removendo o padrão NN/NN
                    clean_desc = description[:match.start()]

                    # Remover letras/digitos que fazem parte do código de parcela
                    # Ex: "CIATOY BRINQUEDOS LT02/10" → remover "LT" também
                    # Ex: "HOTMART asimovacadem02/12" → manter "asimovacadem" pois faz parte do nome
                    # Heurística: se termina com 1-3 letras maiúsculas após espaço, remover
                    clean_desc_strip = clean_desc.rstrip()
                    letter_suffix = re.search(r' ([A-Z]{1,3})$', clean_desc_strip)
                    if letter_suffix:
                        clean_desc = clean_desc_strip[:letter_suffix.start()]

                    clean_desc = clean_desc.rstrip('*- ')

                    # Se a descrição ficou vazia ou muito curta, manter original
                    if len(clean_desc.strip()) < 3:
                        clean_desc = description[:match.start()].rstrip('*- ')

                    print(f"[LLM_OCR] Parcelamento extraído: '{description}' → '{clean_desc.strip()}' ({current}/{total})")

                    item['description'] = clean_desc.strip() if clean_desc.strip() else description
                    item['is_installment'] = True
                    item['installment_current'] = current
                    item['installment_total'] = total
                    fixed_count += 1

        if fixed_count > 0:
            print(f"[LLM_OCR] Total de {fixed_count} parcelamentos corrigidos (Bradesco/AMEX)")

        return items

    def _normalize_description(self, desc: str) -> str:
        """Normaliza descricao para comparacao"""
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
        """Remove parcelas duplicadas, mantendo apenas a de menor numero"""
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
        """Remove itens que sao resumos/totais da fatura"""
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

    def _fix_suspicious_installments(self, items: list) -> list:
        """
        Corrige parcelas suspeitas onde installment_total=1 mas provavelmente é maior.

        Isso acontece quando o LLM não consegue extrair corretamente o total de parcelas
        do formato XX/YY da coluna Parcela do Santander.

        Heurística: Se há múltiplos itens do mesmo estabelecimento com parcela 1/1,
        provavelmente são parcelas diferentes que não foram interpretadas corretamente.
        Neste caso, mantemos como está pois não temos como saber o total correto.

        Mas se temos apenas UM item com 1/1 de um estabelecimento que parece parcelado
        (valor baixo, descrição comum), podemos tentar inferir do contexto.
        """
        # Por enquanto, apenas logamos para debug
        suspicious = [
            item for item in items
            if item.get('is_installment')
            and item.get('installment_current') == 1
            and item.get('installment_total') == 1
        ]

        if suspicious:
            for item in suspicious:
                print(f"[LLM_OCR] WARNING: Suspicious 1/1 installment: {item.get('description')} R${item.get('amount')}")

        return items

    def _filter_consecutive_installments(self, items: list) -> list:
        """
        Agrupa parcelas consecutivas do mesmo estabelecimento em um único item.

        Santander mostra todas as parcelas (01/12 a 12/12) de uma compra na mesma fatura.
        Isso deve ser agrupado em 1 item apenas.

        Critérios para agrupar:
        - Mesmo estabelecimento (descrição normalizada)
        - Mesma data
        - Valores similares (±5%)
        - Parcelas sequenciais começando em 1 (01/12, 02/12, 03/12...)
        """
        if not items:
            return items

        # Separar itens parcelados e não parcelados
        non_installment_items = [i for i in items if not i.get('is_installment')]
        installment_items = [i for i in items if i.get('is_installment')]

        if not installment_items:
            return items

        # Agrupar por (descrição normalizada, data)
        groups = {}
        for item in installment_items:
            desc_norm = self._normalize_description(item.get('description', ''))
            item_date = item.get('date', '')
            key = (desc_norm, item_date)

            if key not in groups:
                groups[key] = []
            groups[key].append(item)

        # Processar cada grupo
        result_items = list(non_installment_items)

        for (desc_norm, item_date), group in groups.items():
            if len(group) == 1:
                # Grupo com 1 item - manter como está
                result_items.append(group[0])
                continue

            # Ordenar por número da parcela
            sorted_group = sorted(group, key=lambda x: x.get('installment_current', 0))

            # Verificar se são parcelas consecutivas começando em 1
            parcelas = [g.get('installment_current', 0) for g in sorted_group]
            totais = [g.get('installment_total', 0) for g in sorted_group]
            valores = [g.get('amount', 0) for g in sorted_group]

            # Verificar: começa em 1, sequencial, mesmo total
            starts_at_1 = parcelas[0] == 1
            is_sequential = all(parcelas[i] == parcelas[i-1] + 1 for i in range(1, len(parcelas)))
            same_total = len(set(totais)) == 1
            # Valores similares (primeiro vs resto, tolerância 5%)
            first_val = valores[0]
            similar_values = all(abs(v - first_val) / first_val < 0.05 if first_val > 0 else True for v in valores)

            if starts_at_1 and is_sequential and same_total and similar_values and len(group) >= 3:
                # Agrupar: manter apenas o primeiro item
                first_item = sorted_group[0].copy()
                print(f"[LLM_OCR] Agrupando {len(group)} parcelas consecutivas de '{desc_norm}' em 1 item (parcela 1/{totais[0]})")
                result_items.append(first_item)
            else:
                # Não agrupar - manter todos
                result_items.extend(group)

        return result_items

    def _remove_cancelled_purchases(self, items: list, card_info: dict | None) -> list:
        """
        Remove compras que foram canceladas (tem estorno correspondente).

        Casos tratados:
        1. Compra parcelada agrupada (1 item, installment_total=12) + estorno do valor total
        2. Multiplas parcelas do mesmo item + estorno
        3. Compra simples + estorno
        """
        if not items:
            return items

        items_to_remove = set()

        # Encontrar estornos/creditos (valores negativos grandes)
        estornos = [
            (i, item) for i, item in enumerate(items)
            if item.get('transaction_type') in ['estorno', 'credito'] and item.get('amount', 0) < -100
        ]

        if not estornos:
            return items

        # Agrupar parcelas por descricao normalizada
        parcela_groups = {}
        for i, item in enumerate(items):
            if not item.get('is_installment') or item.get('transaction_type') != 'compra':
                continue

            desc_norm = self._normalize_description(item['description'])
            if desc_norm not in parcela_groups:
                parcela_groups[desc_norm] = []
            parcela_groups[desc_norm].append((i, item))

        # Para cada grupo de parcelas, verificar se ha estorno correspondente
        for desc_norm, grupo in parcela_groups.items():
            # Ordenar por numero da parcela
            grupo_ordenado = sorted(grupo, key=lambda x: x[1].get('installment_current', 0))

            # Calcular valor total das parcelas do grupo
            # Caso 1: Grupo com multiplos itens - somar todos
            # Caso 2: Item unico agrupado pelo LLM - multiplicar por installment_total
            if len(grupo) > 1:
                valor_total_grupo = sum(g[1].get('amount', 0) for g in grupo)
            else:
                # Item unico - pode ser agrupado (valor * installment_total)
                item = grupo[0][1]
                valor_total_grupo = item['amount'] * item.get('installment_total', 1)

            # Buscar estorno correspondente
            for e_idx, estorno in estornos:
                if e_idx in items_to_remove:
                    continue  # Ja usado

                estorno_valor = abs(estorno.get('amount', 0))

                # Tolerancia de 2% ou R$ 10
                tolerancia = max(valor_total_grupo * 0.02, 10)

                if abs(estorno_valor - valor_total_grupo) <= tolerancia:
                    # Verificar nome - aceita match direto OU estorno generico
                    estorno_nome = estorno['description'].upper()
                    is_generic_estorno = estorno_nome in ['ESTORNO', 'CREDITO', 'DEVOLUCAO', 'CANCELAMENTO']

                    desc_compra = grupo[0][1]['description'].upper()
                    compra_parts = set(desc_compra.replace("*", " ").split())
                    estorno_parts = set(estorno_nome.replace("*", " ").split())
                    has_name_overlap = bool(compra_parts & estorno_parts)

                    if is_generic_estorno or has_name_overlap:
                        # Match encontrado! Remover todas as parcelas + estorno
                        print(f"[LLM_OCR] Removendo compra cancelada: {desc_norm} ({len(grupo)} item(s), total R${valor_total_grupo:.2f}) + estorno R${estorno_valor:.2f}")

                        for idx, _ in grupo:
                            items_to_remove.add(idx)
                        items_to_remove.add(e_idx)
                        break

        # Verificar compras simples (nao parceladas)
        for i, item in enumerate(items):
            if i in items_to_remove:
                continue
            if item.get('is_installment') or item.get('transaction_type') != 'compra':
                continue

            valor = item.get('amount', 0)
            if valor <= 0:
                continue

            for e_idx, estorno in estornos:
                if e_idx in items_to_remove:
                    continue

                estorno_valor = abs(estorno.get('amount', 0))
                tolerancia = max(valor * 0.05, 5)

                if abs(estorno_valor - valor) <= tolerancia:
                    estorno_nome = estorno['description'].upper()
                    compra_nome = item['description'].upper()
                    compra_parts = set(compra_nome.replace("*", " ").split())
                    estorno_parts = set(estorno_nome.replace("*", " ").split())

                    if bool(compra_parts & estorno_parts):
                        print(f"[LLM_OCR] Removendo compra simples cancelada: {item['description']} R${valor:.2f}")
                        items_to_remove.add(i)
                        items_to_remove.add(e_idx)
                        break

        if items_to_remove:
            print(f"[LLM_OCR] Total: {len(items_to_remove)} itens removidos por cancelamento")
            return [item for i, item in enumerate(items) if i not in items_to_remove]

        return items

    def _remove_total_items(self, items: list, card_info: dict | None) -> list:
        """
        Remove itens que são totais/resumos da fatura.

        Detecta:
        1. Itens com descrição que começa com "Total"
        2. Itens com valor igual ao total_amount da fatura
        """
        if not items:
            return items

        total_amount = card_info.get('total_amount') if card_info else None

        removed = []
        result = []

        for item in items:
            desc = item.get('description', '').lower().strip()
            amount = item.get('amount', 0)

            # Verificar se descrição indica total
            is_total_desc = (
                desc.startswith('total ') or
                desc.startswith('total para ') or
                'total da fatura' in desc or
                'total fatura' in desc
            )

            # Verificar se valor é igual ao total_amount (com tolerância)
            is_total_value = (
                total_amount and
                abs(amount - total_amount) < 0.01 and
                amount > 100  # Evitar falsos positivos com valores pequenos
            )

            if is_total_desc or is_total_value:
                removed.append(f"'{item.get('description')}' R${amount:.2f}")
            else:
                result.append(item)

        if removed:
            print(f"[LLM_OCR] Removidos itens de total/resumo: {', '.join(removed)}")

        return result

    def _validate_extraction(self, items: list, card_info: dict | None) -> dict:
        """
        Valida a extracao comparando soma dos itens com total_amount.

        Returns:
            Dict com is_valid, difference, e detalhes
        """
        if not card_info or not card_info.get('total_amount'):
            return {"is_valid": True, "difference": 0}

        total_amount = card_info['total_amount']

        # Soma itens que compoem o total (compra, anuidade, encargo)
        soma_debitos = sum(
            item.get('amount', 0) for item in items
            if item.get('transaction_type') in ['compra', 'anuidade', 'encargo']
        )

        # Soma creditos e estornos (valores negativos que reduzem o total)
        soma_creditos = sum(
            item.get('amount', 0) for item in items
            if item.get('transaction_type') in ['credito', 'estorno']
        )

        # Tenta duas formulas: com e sem creditos
        diff_sem_creditos = soma_debitos - total_amount
        diff_com_creditos = (soma_debitos + soma_creditos) - total_amount

        # Usa a formula que da menor diferenca
        if abs(diff_com_creditos) < abs(diff_sem_creditos):
            difference = diff_com_creditos
            soma_final = soma_debitos + soma_creditos
        else:
            difference = diff_sem_creditos
            soma_final = soma_debitos

        # Tolerancia de R$ 50 (para cobrir pequenos itens faltantes)
        is_valid = abs(difference) <= 50.0

        return {
            "is_valid": is_valid,
            "difference": difference,
            "total_amount": total_amount,
            "soma_debitos": soma_final,
            "num_items": len(items)
        }

    def _try_fix_validation_by_removing_purchases(self, items: list, card_info: dict | None) -> list:
        """
        Se a validacao falha com valor muito alto, tenta remover compras parceladas
        que podem ter sido canceladas (mesmo sem estorno explicito no resultado).

        Esta e uma heuristica para casos onde o modelo nao extrai o estorno.
        """
        if not card_info or not card_info.get('total_amount'):
            return items

        total_amount = card_info['total_amount']

        # Calcular diferenca atual
        soma_debitos = sum(
            item.get('amount', 0) for item in items
            if item.get('transaction_type') in ['compra', 'anuidade', 'encargo']
        )
        soma_creditos = sum(
            item.get('amount', 0) for item in items
            if item.get('transaction_type') in ['credito', 'estorno']
        )

        diff_atual = (soma_debitos + soma_creditos) - total_amount

        # Se a diferenca e pequena ou negativa, nao fazer nada
        if diff_atual <= 5.0:
            return items

        # Encontrar compras parceladas (primeira parcela sao mais provaveis de cancelamento)
        parceladas = [
            (i, item) for i, item in enumerate(items)
            if item.get('is_installment')
            and item.get('transaction_type') == 'compra'
            and item.get('installment_total')
            and item.get('installment_current') == 1  # Primeira parcela
        ]

        # Tentar remover cada parcelada e verificar se melhora a validacao
        best_removal = None
        best_diff = diff_atual

        for p_idx, compra in parceladas:
            nova_diff = diff_atual - compra.get('amount', 0)

            # Se remover esta compra melhora significativamente a diferenca
            if abs(nova_diff) < abs(best_diff):
                # Aceitar se: ficamos dentro de R$ 50 ou a diferenca ficou <= 5
                if abs(nova_diff) <= 50 or abs(nova_diff) <= 5.0:
                    best_removal = p_idx
                    best_diff = nova_diff

        if best_removal is not None and abs(best_diff) < abs(diff_atual):
            # Remover a compra
            return [item for i, item in enumerate(items) if i != best_removal]

        return items

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

                # Inferir transaction_type se nao fornecido
                transaction_type = item.get('transaction_type', 'compra')
                category = item.get('category', 'outros')

                # Inferir transaction_type pela categoria se nao veio explicito
                if transaction_type == 'compra':
                    if category in ['pagamento']:
                        transaction_type = 'pagamento'
                    elif category in ['estorno']:
                        transaction_type = 'estorno'
                    elif category in ['credito']:
                        transaction_type = 'credito'
                    elif category in ['saldo_anterior']:
                        transaction_type = 'saldo_anterior'
                    elif 'anuidade' in description.lower():
                        transaction_type = 'anuidade'

                # Validar transaction_type
                valid_types = ['compra', 'anuidade', 'encargo', 'estorno', 'credito', 'pagamento', 'saldo_anterior']
                if transaction_type not in valid_types:
                    transaction_type = 'compra'

                normalized = {
                    'description': description,
                    'amount': float(amount) if amount else 0,
                    'date': item.get('date'),
                    'category': category,
                    'transaction_type': transaction_type,
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

            # Nao aplicar filtros aqui - deixar para o fluxo principal
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
                        print(f"[LLM_OCR] Extraido due_day={due.day} de due_date={result['card_info']['due_date']}")
                    except ValueError as e:
                        print(f"[LLM_OCR] Erro ao extrair due_day: {e}")

                result['card_info'] = {k: v for k, v in result['card_info'].items() if v is not None}

            return result

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            return {
                'items': [],
                'error': f'Erro ao processar resposta: {str(e)}',
                'raw': content[:500] if content else '',
            }
