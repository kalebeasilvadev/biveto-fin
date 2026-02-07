import { z } from 'zod'

export const pointsPrograms = [
  { value: 'livelo', label: 'Livelo' },
  { value: 'esfera', label: 'Esfera' },
  { value: 'smiles', label: 'Smiles' },
  { value: 'tudoazul', label: 'TudoAzul' },
  { value: 'latam_pass', label: 'LATAM Pass' },
  { value: 'multiplus', label: 'Multiplus' },
  { value: 'dotz', label: 'Dotz' },
  { value: 'cashback', label: 'Cashback' },
  { value: 'other', label: 'Outro' },
] as const

export const cardBrands = [
  'Visa',
  'Mastercard',
  'Elo',
  'American Express',
  'Hipercard',
  'Diners Club',
] as const

export const defaultColors = [
  '#1e1e1e', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f97316', '#eab308', '#14b8a6', '#22c55e',
] as const

export const creditCardSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome do cartão é obrigatório')
    .max(100, 'Nome muito longo'),
  nickname: z
    .string()
    .max(50, 'Apelido muito longo')
    .nullable()
    .default(null),
  bank_id: z.string().nullable().default(null),
  credit_limit: z
    .number({ invalid_type_error: 'Informe um valor válido' })
    .min(0.01, 'Limite deve ser maior que zero'),
  initial_balance: z
    .number()
    .min(0, 'Saldo inicial não pode ser negativo')
    .default(0),
  closing_day: z
    .number({ invalid_type_error: 'Informe um dia válido' })
    .min(1, 'Dia deve ser entre 1 e 31')
    .max(31, 'Dia deve ser entre 1 e 31'),
  due_day: z
    .number({ invalid_type_error: 'Informe um dia válido' })
    .min(1, 'Dia deve ser entre 1 e 31')
    .max(31, 'Dia deve ser entre 1 e 31'),
  has_points: z.boolean().default(false),
  points_program: z.string().nullable().default(null),
  points_factor: z
    .number()
    .min(0, 'Fator não pode ser negativo')
    .default(1),
  card_brand: z.string().nullable().default(null),
  card_variant: z.string().max(50, 'Variante muito longa').nullable().default(null),
  last_four_digits: z
    .string()
    .regex(/^\d{0,4}$/, 'Deve conter apenas 4 dígitos')
    .nullable()
    .default(null),
  annual_fee: z
    .number()
    .min(0, 'Anuidade não pode ser negativa')
    .nullable()
    .default(null),
  annual_fee_frequency: z.enum(['monthly', 'yearly']).default('monthly'),
  annual_fee_waived: z.boolean().default(false),
  benefits_notes: z.string().max(500, 'Notas muito longas').nullable().default(null),
  color: z.string().default('#1e1e1e'),
  ownership_type: z.enum(['personal', 'household']).default('personal'),
})

export type CreditCardFormData = z.infer<typeof creditCardSchema>

export interface CreditCard {
  id: number
  account_id: number
  name: string
  nickname: string | null
  bank_id: string | null
  credit_limit: number
  current_balance: number
  available_limit: number
  closing_day: number
  due_day: number
  has_points: boolean
  points_program: string | null
  points_factor?: number
  card_brand: string | null
  card_variant: string | null
  last_four_digits: string | null
  color: string | null
  icon: string | null
  is_active: boolean
  annual_fee: number | null
  annual_fee_frequency: 'monthly' | 'yearly'
  annual_fee_waived: boolean
  has_invoice_password?: boolean // Indicates if invoice PDF password is saved
}

export interface CreditCardPayload {
  name: string
  nickname: string | null
  bank_id: string | null
  credit_limit: number
  initial_balance: number
  closing_day: number
  due_day: number
  has_points: boolean
  points_program: string | null
  points_factor: number
  card_brand: string | null
  card_variant: string | null
  last_four_digits: string | null
  annual_fee: number | null
  annual_fee_frequency: 'monthly' | 'yearly'
  annual_fee_waived: boolean
  benefits_notes: string | null
  color: string
  ownership_type: 'personal' | 'household'
}
