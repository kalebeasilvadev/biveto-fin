import { useState, useEffect } from 'react'
import { X, AlertTriangle, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { benefitCardsApi } from '@/services/api'
import { toast } from 'react-hot-toast'
import CurrencyInput from '@/components/shared/CurrencyInput'

const balanceAdjustmentSchema = z.object({
  current_balance: z.number(),
  desired_balance: z.number(),
  adjustment_amount: z.number(),
  reason: z.string().min(3, 'Motivo deve ter pelo menos 3 caracteres').max(500, 'Máximo 500 caracteres'),
})

type BalanceAdjustmentFormData = z.infer<typeof balanceAdjustmentSchema>

interface BalanceAdjustmentModalProps {
  isOpen: boolean
  onClose: () => void
  card: {
    id: number
    name: string
    card_type_display: string
    provider_display: string | null
    current_balance: number
    color: string | null
  }
}

export default function BalanceAdjustmentModal({ isOpen, onClose, card }: BalanceAdjustmentModalProps) {
  const [desiredBalance, setDesiredBalance] = useState<number>(0)
  const [adjustment, setAdjustment] = useState<number>(0)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<BalanceAdjustmentFormData>({
    resolver: zodResolver(balanceAdjustmentSchema),
    defaultValues: {
      current_balance: card.current_balance,
      desired_balance: 0,
      adjustment_amount: 0,
      reason: '',
    },
  })

  // Calcular ajuste automaticamente
  useEffect(() => {
    const newAdjustment = desiredBalance - card.current_balance
    setAdjustment(newAdjustment)
    setValue('adjustment_amount', newAdjustment)
  }, [desiredBalance, card.current_balance, setValue])

  const adjustBalanceMutation = useMutation({
    mutationFn: async (data: { adjustment_amount: number; reason: string }) => {
      const response = await benefitCardsApi.adjustBalance(card.id, data)
      return response.data
    },
    onSuccess: (data) => {
      toast.success(
        `Saldo ajustado com sucesso!\nDe: ${data.old_balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n` +
        `Para: ${data.new_balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      )
      queryClient.invalidateQueries({ queryKey: ['benefit-cards'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      reset()
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Erro ao ajustar saldo')
    },
  })

  const onSubmit = (data: BalanceAdjustmentFormData) => {
    adjustBalanceMutation.mutate({
      adjustment_amount: data.adjustment_amount,
      reason: data.reason,
    })
  }

  if (!isOpen) return null

  const isNegativeBalance = card.current_balance < 0
  const isIncreasing = adjustment > 0
  const isDecreasing = adjustment < 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Ajustar Saldo
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {card.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Alerta de Saldo Negativo */}
          {isNegativeBalance && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  Saldo Negativo Detectado
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  O saldo no sistema está negativo. Isso geralmente indica que houve compras sem lançamento de recarga,
                  ou erro nos lançamentos anteriores.
                </p>
              </div>
            </div>
          )}

          {/* Saldo Atual */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Saldo Atual no Sistema
            </label>
            <div className={`p-4 rounded-lg border-2 ${
              isNegativeBalance
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600'
            }`}>
              <p className={`text-2xl font-bold ${
                isNegativeBalance
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {card.current_balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          {/* Saldo Desejado */}
          <div>
            <label htmlFor="desired_balance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Saldo Real no Cartão Físico *
            </label>
            <CurrencyInput
              id="desired_balance"
              value={desiredBalance}
              onChange={(value) => setDesiredBalance(value || 0)}
              placeholder="R$ 0,00"
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Insira o saldo que aparece no aplicativo do cartão (Alelo, Sodexo, etc.)
            </p>
          </div>

          {/* Ajuste Calculado */}
          {adjustment !== 0 && (
            <div className={`p-4 rounded-lg border-2 ${
              isIncreasing
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {isIncreasing ? (
                  <TrendingUp className="text-blue-500" size={20} />
                ) : (
                  <TrendingDown className="text-amber-500" size={20} />
                )}
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ajuste a ser aplicado
                </p>
              </div>
              <p className={`text-xl font-bold ${
                isIncreasing
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {adjustment > 0 ? '+' : ''}
                {adjustment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {isIncreasing ? 'Adicionará' : 'Subtrairá'} este valor do saldo
              </p>
            </div>
          )}

          {/* Motivo */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Motivo do Ajuste *
            </label>
            <textarea
              id="reason"
              {...register('reason')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg
                       bg-white dark:bg-slate-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-400 dark:placeholder:text-gray-500"
              placeholder="Ex: Saldo divergente - valor correto verificado no app Alelo"
            />
            {errors.reason && (
              <p className="text-sm text-red-500 mt-1">{errors.reason.message}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Este motivo será registrado para auditoria
            </p>
          </div>

          {/* Preview do Resultado */}
          {adjustment !== 0 && (
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 border border-gray-200 dark:border-slate-600">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Preview</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">De:</p>
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    {card.current_balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div className="text-gray-400">→</div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Para:</p>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {desiredBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={adjustBalanceMutation.isPending}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300
                       rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={adjustBalanceMutation.isPending || adjustment === 0 || !watch('reason')}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
            >
              {adjustBalanceMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ajustando...
                </>
              ) : (
                <>
                  <DollarSign size={18} />
                  Ajustar Saldo
                </>
              )}
            </button>
          </div>

          {/* Nota de Rodapé */}
          <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              💡 <strong>Dica:</strong> Use o ajuste quando o saldo no sistema divergir do saldo real no cartão físico
              (verificado no app da operadora).
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
