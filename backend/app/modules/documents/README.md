# Modulo Documents

## Descricao
Modulo responsavel pelo upload e processamento de documentos financeiros. Utiliza LLM Vision (Google Gemini) para extracao de dados de faturas, cupons fiscais e extratos bancarios com alta precisao.

## Responsabilidades
- Upload e validacao de arquivos (PDF, imagens, CSV, Excel)
- Extracao de dados com LLM Vision (Google Gemini)
- Parser de planilhas (CSV/Excel) de bancos brasileiros
- Deteccao de duplicatas
- Identificacao de parcelamentos
- Deteccao de servicos recorrentes (Netflix, Spotify, etc.)
- Reprocessamento de documentos com falha

## Estrutura
```
documents/
├── __init__.py
├── models/
│   └── __init__.py       # Re-exporta models de app.models
├── schemas/
│   └── document.py       # DocumentResponse, DocumentExtractionResponse, ExtractedItemResponse,
│                         # FutureInstallmentResponse, InstallmentAnalysisResponse, CardInfoResponse
├── services/
│   ├── document_service.py         # DocumentService (upload, processamento)
│   ├── llm_ocr_service.py          # LLMOCRService (Google Gemini Vision)
│   └── spreadsheet_parser_service.py # Parser de CSV/Excel
├── prompts/
│   ├── __init__.py
│   ├── detalhes_faturas.md         # Prompt para extracao de faturas
│   └── explicacao_erro_santander.md # Explicacao de erros Santander
└── routers/
    └── documents.py      # Endpoints de documentos
```

## Dependencias
- **Models**: `Document`, `DocumentExtraction`
- **Outros Modulos**: `known_services` (deteccao de recorrencias)
- **Core**: `deps` (CurrentUser, DbSession)

## Tipos de Documento
- `fatura_cartao`: Faturas de cartao de credito
- `cupom_fiscal`: Cupons fiscais / notas fiscais
- `comprovante`: Comprovantes de pagamento
- `extrato`: Extratos bancarios (CSV/Excel)

## Bancos Suportados para Extratos
- Nubank
- Inter
- Itau
- Bradesco
- Santander
- Banco do Brasil
- C6 Bank
- E outros...

## Endpoints

### Router Documents (`/documents`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `` | Upload de documento para processamento |
| GET | `` | Lista documentos do usuario |
| GET | `/{document_id}` | Retorna documento com dados extraidos |
| POST | `/{document_id}/retry` | Reprocessa documento que falhou |
| DELETE | `/{document_id}` | Remove documento e arquivo |

## Uso
```python
from app.modules.documents import (
    # Router
    router,
    # Schemas
    FutureInstallmentResponse,
    ExtractedItemResponse,
    InstallmentAnalysisResponse,
    DocumentExtractionResponse,
    CardInfoResponse,
    DocumentResponse,
    # Services
    DocumentService,
    LLMOCRService,
    SpreadsheetParserService,
)
```

## Fluxo de Processamento
1. Upload do arquivo
2. Validacao de formato e tamanho
3. Deteccao de duplicatas (hash do arquivo)
4. Processamento:
   - **PDF/Imagens**: LLM Vision (Gemini) com Structured Output
   - **CSV/Excel**: SpreadsheetParserService
5. Extracao de itens (transacoes)
6. Identificacao de parcelamentos
7. Deteccao de servicos recorrentes (Netflix, Spotify, etc.) via `RecurringDetectorService`
8. Verificacao de transacoes duplicadas no banco
9. Extracao de informacoes do cartao (para faturas) em `card_info`
10. Retorno dos dados para confirmacao pelo usuario

## Tecnologia de Extracao

O modulo utiliza **Google Gemini Vision** com **Structured Output** (Pydantic schemas) para garantir:
- Alta precisao na extracao de dados
- Formato estruturado e validado
- Suporte a PDFs multipaginas
- Deteccao de transacoes canceladas/estornadas

## Schemas

### DocumentResponse
Response principal do upload/get de documentos.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | `int` | ID do documento |
| `file_hash` | `str` | Hash SHA256 do arquivo |
| `original_filename` | `str` | Nome original do arquivo |
| `mime_type` | `str` | Tipo MIME do arquivo |
| `status` | `DocumentStatus` | `pending`, `processing`, `completed`, `failed` |
| `document_type` | `DocumentType` | Tipo detectado (`fatura_cartao`, `cupom_fiscal`, etc.) |
| `error_message` | `str \| None` | Mensagem de erro se falhou |
| `extracted_items` | `list[ExtractedItemResponse]` | Itens extraidos do documento |
| `is_duplicate` | `bool` | Se arquivo ja foi enviado antes |
| `card_info` | `CardInfoResponse \| None` | Informacoes do cartao (apenas para faturas) |

### CardInfoResponse
Informacoes do cartao extraidas de uma fatura.

#### Identificacao do Cartao
| Campo | Tipo | Descricao |
|-------|------|-----------|
| `card_issuer` | `str \| None` | Codigo do emissor (nubank, itau, bradesco, bradescard) |
| `card_bank` | `str \| None` | Nome completo do banco (Bradesco, Itau Unibanco) |
| `card_brand` | `str \| None` | Bandeira (visa, mastercard, elo, hipercard, amex) |
| `card_partner` | `str \| None` | Parceiro co-branded (amazon, smiles, latam, rappi) |
| `card_last_digits` | `str \| None` | Ultimos 4 digitos do cartao |
| `card_name` | `str \| None` | Nome completo do cartao (ex: Bradesco Amazon Visa) |

#### Informacoes da Fatura
| Campo | Tipo | Descricao |
|-------|------|-----------|
| `invoice_month` | `int \| None` | Mes da fatura (1-12) |
| `invoice_year` | `int \| None` | Ano da fatura |
| `closing_date` | `str \| None` | Data de fechamento (YYYY-MM-DD) |
| `closing_day` | `int \| None` | Dia do fechamento (1-31) |
| `due_date` | `str \| None` | Data de vencimento (YYYY-MM-DD) |
| `due_day` | `int \| None` | Dia do vencimento (1-31) |
| `total_amount` | `float \| None` | Valor total da fatura |

#### Limites do Cartao (se disponivel na fatura)
| Campo | Tipo | Descricao |
|-------|------|-----------|
| `credit_limit` | `float \| None` | Limite total do cartao |
| `credit_used` | `float \| None` | Limite utilizado/comprometido |
| `credit_available` | `float \| None` | Limite disponivel |

### FutureInstallmentResponse
Parcela futura calculada pelo LLM (para Santander/Itau que mostram todas as parcelas).

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `installment` | `int` | Numero da parcela (ex: 4) |
| `reference_month` | `int` | Mes de referencia (1-12) |
| `reference_year` | `int` | Ano de referencia |

### ExtractedItemResponse
Item individual extraido do documento.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `description` | `str` | Descricao da transacao |
| `amount` | `float` | Valor da transacao |
| `date` | `str \| None` | Data no formato YYYY-MM-DD |
| `category` | `str \| None` | Categoria sugerida pelo LLM |
| `confidence` | `float` | Confianca da extracao (0-1) |
| `is_installment` | `bool` | Se e uma parcela |
| `installment_current` | `int \| None` | Parcela atual (ex: 3) |
| `installment_total` | `int \| None` | Total de parcelas (ex: 12) |
| `future_installments` | `list[FutureInstallmentResponse] \| None` | Parcelas futuras |
| `is_duplicate` | `bool` | Se ja existe transacao similar no banco |
| `existing_transaction_id` | `int \| None` | ID da transacao existente se duplicada |
| `recurring_detection` | `RecurringDetection \| None` | Deteccao de servico recorrente |

### InstallmentAnalysisResponse
Resultado da analise de parcela.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `is_installment` | `bool` | Se e uma parcela |
| `series_found` | `dict \| None` | Serie de parcelas encontrada |
| `installment_exists` | `bool` | Se a parcela ja existe |
| `suggestion` | `str \| None` | Sugestao: `create_single`, `create_series`, `add_to_series`, `skip` |

## Deteccao de Servicos Recorrentes

Apos a extracao, cada item e analisado pelo `RecurringDetectorService` para identificar:
- Servicos conhecidos (Netflix, Spotify, iFood Club, etc.)
- Recorrencias ja cadastradas pelo usuario
- Duplicidades suspeitas no mesmo periodo

### Campo `recurring_detection` no ExtractedItemResponse

```json
{
  "description": "NETFLIX.COM",
  "amount": 55.90,
  "date": "2026-01-15",
  "recurring_detection": {
    "is_known_service": true,
    "known_service_name": "Netflix",
    "is_user_recurring": false,
    "suggested_recurring": {
      "name": "Netflix",
      "amount": 55.90,
      "frequency": "monthly",
      "day_of_month": 15
    },
    "confidence": 0.95
  }
}
```

### Tipos de Duplicidade

| Tipo | Descricao |
|------|-----------|
| `none` | Unica ocorrencia |
| `legitimate` | Valores diferentes ou ciclos distintos |
| `suspicious` | Valores iguais com datas proximas |
| `error` | 3+ cobrancas no mesmo periodo |

Ver documentacao do modulo `known_services` para mais detalhes.
