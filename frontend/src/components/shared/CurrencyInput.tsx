import { forwardRef, useState, useEffect } from 'react'
import { clsx } from 'clsx'

interface CurrencyInputProps {
  value: number | null | undefined
  onChange: (value: number | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  error?: boolean
  id?: string
  name?: string
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseCurrency(value: string): number | null {
  // Remove tudo exceto números
  const numbers = value.replace(/\D/g, '')
  if (!numbers) return null
  // Converte para centavos e depois para reais
  return parseInt(numbers, 10) / 100
}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, placeholder = '0,00', disabled = false, className, error, id, name }, ref) => {
    const [displayValue, setDisplayValue] = useState('')

    // Atualiza o display quando o valor externo muda
    useEffect(() => {
      if (value !== null && value !== undefined && value > 0) {
        setDisplayValue(formatCurrency(value))
      } else {
        setDisplayValue('')
      }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      const numericValue = parseCurrency(inputValue)

      if (numericValue !== null) {
        setDisplayValue(formatCurrency(numericValue))
        onChange(numericValue)
      } else {
        setDisplayValue('')
        onChange(null)
      }
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Seleciona todo o texto ao focar
      e.target.select()
    }

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none">
          R$
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          id={id}
          name={name}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={clsx(
            'input pl-10',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            className
          )}
        />
      </div>
    )
  }
)

CurrencyInput.displayName = 'CurrencyInput'

export default CurrencyInput
