import { z } from 'zod'

// Tipos de cartao de beneficio
export const benefitCardTypes = [
  { value: 'va', label: 'Vale Alimentacao', description: 'Supermercados e sacoloes' },
  { value: 'vr', label: 'Vale Refeicao', description: 'Restaurantes e lanchonetes' },
  { value: 'flex', label: 'Flex (VA/VR)', description: 'Aceito em ambos os tipos' },
  { value: 'vt', label: 'Vale Transporte', description: 'Transporte publico' },
  { value: 'cultura', label: 'Vale Cultura', description: 'Cinemas, livros, shows' },
  { value: 'combustivel', label: 'Vale Combustivel', description: 'Postos de combustivel' },
] as const

// Operadoras de beneficio
export const benefitProviders = [
  { value: 'alelo', label: 'Alelo', color: '#00A859' },
  { value: 'sodexo', label: 'Sodexo', color: '#FF0000' },
  { value: 'vr', label: 'VR', color: '#003399' },
  { value: 'ticket', label: 'Ticket', color: '#E52421' },
  { value: 'flash', label: 'Flash', color: '#7C3AED' },
  { value: 'ifood', label: 'iFood Beneficios', color: '#EA1D2C' },
  { value: 'caju', label: 'Caju', color: '#FF6B00' },
  { value: 'swile', label: 'Swile', color: '#00D9A6' },
  { value: 'pluxee', label: 'Pluxee', color: '#1E3A5F' },
  { value: 'other', label: 'Outro', color: '#6B7280' },
] as const

export const defaultBenefitColors = [
  '#00A859', '#003399', '#FF0000', '#E52421',
  '#7C3AED', '#EA1D2C', '#FF6B00', '#1E3A5F',
] as const

export const benefitCardSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome do cartao e obrigatorio')
    .max(100, 'Nome muito longo'),
  card_type: z.enum(['va', 'vr', 'flex', 'vt', 'cultura', 'combustivel'], {
    required_error: 'Selecione o tipo do cartao',
  }),
  provider: z.enum(['alelo', 'sodexo', 'vr', 'ticket', 'flash', 'ifood', 'caju', 'swile', 'pluxee', 'other']).nullable().default(null),
  last_four_digits: z
    .string()
    .regex(/^\d{0,4}$/, 'Deve conter apenas 4 digitos')
    .nullable()
    .default(null),
  initial_balance: z
    .number()
    .min(0, 'Saldo nao pode ser negativo')
    .default(0),
  expected_monthly_recharge: z
    .number()
    .min(0, 'Valor nao pode ser negativo')
    .nullable()
    .default(null),
  recharge_day: z
    .number({ invalid_type_error: 'Informe um dia valido' })
    .min(1, 'Dia deve ser entre 1 e 31')
    .max(31, 'Dia deve ser entre 1 e 31')
    .nullable()
    .default(null),
  linked_income_source_id: z.number().nullable().default(null),
  color: z.string().default('#00A859'),
  ownership_type: z.enum(['personal', 'household']).default('personal'),
})

export type BenefitCardFormData = z.infer<typeof benefitCardSchema>

export interface BenefitCard {
  id: number
  account_id: number
  name: string
  card_type: string
  card_type_display: string
  provider: string | null
  provider_display: string | null
  last_four_digits: string | null
  current_balance: number
  expected_monthly_recharge: number | null
  recharge_day: number | null
  color: string | null
  icon: string | null
  is_active: boolean
}

export interface BenefitCardPayload {
  name: string
  card_type: string
  provider: string | null
  last_four_digits: string | null
  initial_balance: number
  expected_monthly_recharge: number | null
  recharge_day: number | null
  linked_income_source_id: number | null
  color: string
  ownership_type: 'personal' | 'household'
}
