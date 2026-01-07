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

export interface Document {
  id: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  extracted_items: ExtractedItem[]
  is_duplicate?: boolean
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

export const initialFormData: TransactionFormData = {
  amount: '',
  date: new Date().toISOString().split('T')[0],
  account_id: '',
  category_id: '',
  merchant_name: '',
  description: '',
  type: 'expense',
  is_installment: false,
  installment_current: '',
  installment_total: '',
  ownership_type: 'personal',
}
