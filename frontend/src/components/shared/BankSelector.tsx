import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { banks, Bank, getBankById } from '../../data/banks'
import BankLogo from './BankLogo'
import { clsx } from 'clsx'

interface BankSelectorProps {
  value: string | null
  onChange: (bankId: string | null) => void
  placeholder?: string
  className?: string
  error?: boolean
  disabled?: boolean
}

export default function BankSelector({
  value,
  onChange,
  placeholder = 'Selecione o banco',
  className,
  error,
  disabled,
}: BankSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedBank = value ? getBankById(value) : null

  // Filter banks by search
  const filteredBanks = banks.filter(
    (bank) =>
      bank.name.toLowerCase().includes(search.toLowerCase()) ||
      bank.shortName.toLowerCase().includes(search.toLowerCase())
  )

  // Popular banks for quick access (first 8)
  const popularBanks = banks.slice(0, 8)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (bank: Bank) => {
    onChange(bank.id === 'other' ? null : bank.id)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          'input w-full flex items-center justify-between gap-2 text-left',
          error && 'border-red-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {selectedBank ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <BankLogo bankId={selectedBank.id} size="sm" />
            <span className="truncate">{selectedBank.name}</span>
          </div>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              <X size={14} className="text-gray-400" />
            </button>
          )}
          <ChevronDown size={18} className={clsx('text-gray-400 transition-transform', isOpen && 'rotate-180')} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar banco..."
                className="input w-full pl-9 py-2"
              />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto max-h-60">
            {!search && (
              <>
                {/* Popular banks */}
                <div className="p-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 px-2 mb-2">Populares</p>
                  <div className="grid grid-cols-4 gap-1">
                    {popularBanks.map((bank) => (
                      <button
                        key={bank.id}
                        type="button"
                        onClick={() => handleSelect(bank)}
                        className={clsx(
                          'flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                          value === bank.id && 'bg-primary-50 dark:bg-primary-900/30'
                        )}
                      >
                        <BankLogo bankId={bank.id} size="sm" />
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 truncate w-full text-center">
                          {bank.shortName}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700" />
              </>
            )}

            {/* All banks (filtered) */}
            <div className="p-2">
              {filteredBanks.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Nenhum banco encontrado
                </p>
              ) : (
                filteredBanks.map((bank) => (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => handleSelect(bank)}
                    className={clsx(
                      'flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                      value === bank.id && 'bg-primary-50 dark:bg-primary-900/30'
                    )}
                  >
                    <BankLogo bankId={bank.id} size="sm" />
                    <div className="flex-1 text-left">
                      <p className="text-sm text-gray-900 dark:text-white">{bank.name}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
