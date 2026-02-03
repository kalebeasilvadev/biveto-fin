import { z } from 'zod'

export const balanceAdjustmentSchema = z.object({
  adjustment_amount: z.number().refine((val) => val !== 0, {
    message: 'O ajuste não pode ser zero',
  }),
  reason: z
    .string()
    .min(3, 'Motivo deve ter pelo menos 3 caracteres')
    .max(500, 'Motivo muito longo (máximo 500 caracteres)'),
})

export type BalanceAdjustmentFormData = z.infer<typeof balanceAdjustmentSchema>

export interface BalanceAdjustmentRequest {
  adjustment_amount: number
  reason: string
}

export interface BalanceAdjustmentResponse {
  old_balance: number
  adjustment: number
  new_balance: number
  transaction_id: number
  reason: string
  timestamp: string
}
