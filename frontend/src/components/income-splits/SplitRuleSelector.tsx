import { useQuery } from '@tanstack/react-query'
import { incomeSplitRulesApi } from '../../services/api'
import { Heart, PiggyBank, TrendingUp, Wallet, Percent } from 'lucide-react'
import { clsx } from 'clsx'

interface IncomeSplitRule {
  id: number
  name: string
  split_type: 'percentage' | 'fixed'
  percentage: number | null
  fixed_amount: number | null
  category_name: string | null
  is_active: boolean
}

interface SplitRuleSelectorProps {
  selectedRuleIds: number[]
  onChange: (ruleIds: number[]) => void
  amount: number
  disabled?: boolean
}

function getRuleIcon(name: string) {
  const nameLower = name.toLowerCase()
  if (nameLower.includes('dizimo') || nameLower.includes('doacao') || nameLower.includes('oferta')) {
    return Heart
  }
  if (nameLower.includes('poupanca') || nameLower.includes('reserva')) {
    return PiggyBank
  }
  if (nameLower.includes('invest')) {
    return TrendingUp
  }
  return Wallet
}

function calculateSplitAmount(rule: IncomeSplitRule, incomeAmount: number): number {
  if (rule.split_type === 'percentage' && rule.percentage) {
    return Math.round((incomeAmount * rule.percentage / 100) * 100) / 100
  }
  if (rule.split_type === 'fixed' && rule.fixed_amount) {
    return rule.fixed_amount
  }
  return 0
}

export default function SplitRuleSelector({
  selectedRuleIds,
  onChange,
  amount,
  disabled = false,
}: SplitRuleSelectorProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['income-split-rules-active'],
    queryFn: () => incomeSplitRulesApi.list(true), // Only active rules
  })

  const rules: IncomeSplitRule[] = data?.data || []

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-100 dark:bg-slate-700 rounded-xl p-4 h-24" />
    )
  }

  if (rules.length === 0) {
    return null
  }

  const handleToggle = (ruleId: number) => {
    if (disabled) return

    if (selectedRuleIds.includes(ruleId)) {
      onChange(selectedRuleIds.filter(id => id !== ruleId))
    } else {
      onChange([...selectedRuleIds, ruleId])
    }
  }

  const totalSplitAmount = selectedRuleIds.reduce((sum, ruleId) => {
    const rule = rules.find(r => r.id === ruleId)
    return rule ? sum + calculateSplitAmount(rule, amount) : sum
  }, 0)

  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Percent size={18} className="text-purple-600 dark:text-purple-400" />
        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
          Divisao de Receita
        </span>
      </div>

      <div className="space-y-2">
        {rules.map((rule) => {
          const Icon = getRuleIcon(rule.name)
          const splitAmount = calculateSplitAmount(rule, amount)
          const isSelected = selectedRuleIds.includes(rule.id)

          return (
            <label
              key={rule.id}
              className={clsx(
                'flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all',
                isSelected
                  ? 'bg-purple-100 dark:bg-purple-800/40 border-2 border-purple-400'
                  : 'bg-white dark:bg-slate-700 border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-700',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(rule.id)}
                  disabled={disabled}
                  className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                />
                <div className="flex items-center gap-2">
                  <Icon size={18} className={isSelected ? 'text-purple-600' : 'text-gray-400'} />
                  <div>
                    <span className={clsx(
                      'text-sm font-medium',
                      isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'
                    )}>
                      {rule.name}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {rule.split_type === 'percentage'
                        ? `${rule.percentage}%`
                        : `R$ ${rule.fixed_amount?.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>

              {amount > 0 && (
                <span className={clsx(
                  'text-sm font-bold',
                  isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500'
                )}>
                  R$ {splitAmount.toFixed(2)}
                </span>
              )}
            </label>
          )
        })}
      </div>

      {selectedRuleIds.length > 0 && amount > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-purple-200 dark:border-purple-700">
          <span className="text-sm text-purple-600 dark:text-purple-400">
            Total a deduzir:
          </span>
          <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
            R$ {totalSplitAmount.toFixed(2)}
          </span>
        </div>
      )}

      <p className="text-xs text-purple-500 dark:text-purple-400">
        Serao criadas despesas pendentes vinculadas a esta receita
      </p>
    </div>
  )
}
