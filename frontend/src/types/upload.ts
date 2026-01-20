export interface FutureInstallment {
  installment: number
  reference_month: number
  reference_year: number
}

// Tipos de duplicidade detectada
export type DuplicateType = 'none' | 'legitimate' | 'suspicious' | 'error'

export interface DuplicateAnalysis {
  duplicate_type: DuplicateType
  reason: string
  occurrences_count: number
  other_amounts?: number[]
}

export interface RecurringSuggestion {
  name: string
  amount: number
  frequency: string
  default_category?: string
  day_of_month?: number
}

export interface RecurringDetection {
  is_known_service: boolean
  known_service_id?: number
  known_service_name?: string
  is_user_recurring: boolean
  user_recurring_id?: number
  user_recurring_name?: string
  duplicate_analysis?: DuplicateAnalysis
  suggested_recurring?: RecurringSuggestion
  confidence: number
}

export interface ExtractedItem {
  description: string
  amount: number
  date: string | null
  category: string | null
  confidence: number
  is_installment?: boolean
  installment_current?: number | null
  installment_total?: number | null
  future_installments?: FutureInstallment[] | null
  is_duplicate?: boolean
  existing_transaction_id?: number | null
  recurring_detection?: RecurringDetection
  // Tipo de transacao extraido pelo LLM: compra, estorno, credito, pagamento, anuidade, encargo
  transaction_type?: string | null
  // Campos para cupom fiscal (grocery tracking)
  quantity?: number | null
  unit?: string | null
  unit_price?: number | null
  grocery_category?: string | null
  necessity_type?: string | null
}

export interface CardInfo {
  // Identificacao do cartao
  card_issuer?: string  // Codigo do emissor (nubank, itau, bradesco, bradescard)
  card_bank?: string  // Nome completo do banco (Bradesco, Itau Unibanco)
  card_brand?: string  // Bandeira (visa, mastercard, elo, hipercard, amex)
  card_partner?: string  // Parceiro co-branded (amazon, smiles, latam)
  card_last_digits?: string  // Ultimos 4 digitos
  card_name?: string  // Nome completo do cartao (ex: Bradesco Amazon Visa)

  // Informacoes da fatura
  invoice_month?: number
  invoice_year?: number
  closing_date?: string
  closing_day?: number
  due_date?: string
  due_day?: number
  total_amount?: number

  // Limites do cartao
  credit_limit?: number  // Limite total
  credit_used?: number  // Limite utilizado
  credit_available?: number  // Limite disponivel
}

export interface Document {
  id: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  extracted_items: ExtractedItem[]
  is_duplicate?: boolean
  document_type?: 'cupom_fiscal' | 'fatura_cartao' | 'comprovante' | 'extrato'
  card_info?: CardInfo
}

export type UploadMode = 'select' | 'upload' | 'camera' | 'manual' | 'confirm'

export interface TransactionFormData {
  amount: string
  date: string
  account_id: string
  destination_account_id: string  // Para transferências
  category_id: string
  merchant_name: string
  description: string
  type: 'expense' | 'income' | 'transfer'
  is_installment: boolean
  installment_current: string
  installment_total: string
  ownership_type: 'personal' | 'household'
  // Campos para criar recorrência
  create_recurring: boolean
  recurring_frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export const CATEGORY_MAP: Record<string, string> = {
  'alimentacao': 'Alimentação',
  'transporte': 'Transporte',
  'moradia': 'Moradia',
  'saude': 'Saúde',
  'educacao': 'Educação',
  'lazer': 'Lazer',
  'eletronicos': 'Lazer',
  'roupas': 'Vestuário',
  'mercado': 'Mercado',
  'assinaturas': 'Contas',
  'cartao': 'Contas',
  'servicos': 'Outros',
  'outros': 'Outros',
  // Categorias de serviços recorrentes
  'streaming': 'Entretenimento',
  'software': 'Assinaturas',
  'tecnologia': 'Assinaturas',
  'cloud': 'Assinaturas',
  'jogos': 'Lazer',
  'viagem': 'Viagem',
  'assinatura': 'Assinaturas',
  'entretenimento': 'Entretenimento',
}

// Helper to get local date in YYYY-MM-DD format
const getLocalDateString = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const initialFormData: TransactionFormData = {
  amount: '',
  date: getLocalDateString(),
  account_id: '',
  destination_account_id: '',
  category_id: '',
  merchant_name: '',
  description: '',
  type: 'expense',
  is_installment: false,
  installment_current: '',
  installment_total: '',
  ownership_type: 'personal',
  create_recurring: false,
  recurring_frequency: 'monthly',
}
