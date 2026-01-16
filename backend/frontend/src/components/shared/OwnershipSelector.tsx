import { User, Users } from 'lucide-react'
import { clsx } from 'clsx'

interface OwnershipSelectorProps {
  value: 'personal' | 'household'
  onChange: (value: 'personal' | 'household') => void
  disabled?: boolean
  label?: string
  description?: string
  className?: string
}

/**
 * Componente reutilizável para seleção de ownership (Personal vs Household)
 *
 * @param value - Valor atual ('personal' ou 'household')
 * @param onChange - Callback quando valor muda
 * @param disabled - Se o seletor está desabilitado
 * @param label - Label personalizado (default: "Visibilidade")
 * @param description - Descrição opcional abaixo do label
 * @param className - Classes CSS adicionais
 *
 * @example
 * ```tsx
 * <OwnershipSelector
 *   value={formData.ownership_type}
 *   onChange={(val) => setFormData({...formData, ownership_type: val})}
 *   description="Recursos familiares são compartilhados com todos os membros"
 * />
 * ```
 */
export default function OwnershipSelector({
  value,
  onChange,
  disabled = false,
  label = 'Visibilidade',
  description,
  className = ''
}: OwnershipSelectorProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {description}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {/* Personal option */}
        <button
          type="button"
          onClick={() => !disabled && onChange('personal')}
          disabled={disabled}
          className={clsx(
            'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            value === 'personal'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
              : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Selecionar visibilidade pessoal"
          aria-pressed={value === 'personal'}
        >
          <User
            size={20}
            className={clsx(
              'flex-shrink-0',
              value === 'personal'
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-400 dark:text-gray-500'
            )}
          />
          <div className="text-left flex-1">
            <div className={clsx(
              'text-sm font-medium',
              value === 'personal'
                ? 'text-primary-700 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-300'
            )}>
              Pessoal
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Só você vê
            </div>
          </div>
          {value === 'personal' && (
            <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
          )}
        </button>

        {/* Household option */}
        <button
          type="button"
          onClick={() => !disabled && onChange('household')}
          disabled={disabled}
          className={clsx(
            'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            value === 'household'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
              : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Selecionar visibilidade familiar"
          aria-pressed={value === 'household'}
        >
          <Users
            size={20}
            className={clsx(
              'flex-shrink-0',
              value === 'household'
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-400 dark:text-gray-500'
            )}
          />
          <div className="text-left flex-1">
            <div className={clsx(
              'text-sm font-medium',
              value === 'household'
                ? 'text-primary-700 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-300'
            )}>
              Familiar
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Família vê
            </div>
          </div>
          {value === 'household' && (
            <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
          )}
        </button>
      </div>
    </div>
  )
}
