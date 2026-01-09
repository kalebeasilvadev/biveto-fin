export interface ExtractedItem {
  description: string
  amount: number
  date: string | null
  category: string | null
  confidence: number
  is_installment?: boolean
  installment_current?: number | null
  installment_total?: number | null
}

export interface CardInfo {
  card_issuer?: string
  card_last_digits?: string
  invoice_month?: number
  invoice_year?: number
  due_date?: string
  total_amount?: number
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
  category_id: string
  merchant_name: string
  description: string
  type: 'expense' | 'income'
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
