import { useState } from 'react'
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { cardTemplates, CardTemplate, getPopularTemplates } from '../../data/cardTemplates'
import { getBankById } from '../../data/banks'
import BankLogo from '../shared/BankLogo'
import CardBrandLogo from '../shared/CardBrandLogo'
import { clsx } from 'clsx'
import { useRef } from 'react'

interface CardTemplateSelectorProps {
  onSelect: (template: CardTemplate | null) => void
  onSkip: () => void
}

export default function CardTemplateSelector({ onSelect, onSkip }: CardTemplateSelectorProps) {
  const [search, setSearch] = useState('')
  const [selectedBankFilter, setSelectedBankFilter] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const popularTemplates = getPopularTemplates()

  // Get unique banks from templates
  const uniqueBanks = Array.from(new Set(cardTemplates.map(t => t.bank_id)))
    .map(id => getBankById(id))
    .filter(Boolean)
    .slice(0, 10)

  // Filter templates
  const filteredTemplates = cardTemplates.filter((template) => {
    const matchesSearch = search === '' ||
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.variant.toLowerCase().includes(search.toLowerCase())

    const matchesBank = !selectedBankFilter || template.bank_id === selectedBankFilter

    return matchesSearch && matchesBank
  })

  const handleSelectTemplate = (template: CardTemplate) => {
    onSelect(template)
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  const showPopular = !search && !selectedBankFilter

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="text-center pb-1">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Escolha um modelo
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Selecione para preencher automaticamente
        </p>
      </div>

      {/* Skip button */}
      <button
        type="button"
        onClick={onSkip}
        className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 text-sm"
      >
        <Plus size={16} />
        <span>Criar do zero</span>
      </button>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cartão..."
          className="input w-full pl-8 py-2 text-sm"
        />
      </div>

      {/* Bank filters with scroll buttons */}
      <div className="relative">
        <button
          type="button"
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-800 shadow-md rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ChevronLeft size={14} />
        </button>
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto px-7 py-1 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            type="button"
            onClick={() => setSelectedBankFilter(null)}
            className={clsx(
              'flex-shrink-0 px-2.5 py-1 rounded-full text-xs transition-colors',
              !selectedBankFilter
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            Todos
          </button>
          {uniqueBanks.map((bank) => bank && (
            <button
              key={bank.id}
              type="button"
              onClick={() => setSelectedBankFilter(bank.id)}
              className={clsx(
                'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors',
                selectedBankFilter === bank.id
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              <BankLogo bankId={bank.id} size="sm" className="w-3.5 h-3.5" />
              <span>{bank.shortName}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-800 shadow-md rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Templates grid */}
      <div className="space-y-2">
        {(search || selectedBankFilter) && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              {filteredTemplates.length} encontrado(s)
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setSelectedBankFilter(null)
              }}
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              Limpar
            </button>
          </div>
        )}

        <div className="max-h-[280px] overflow-y-auto pr-1 space-y-3">
          {/* Popular section */}
          {showPopular && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                <span className="text-yellow-500">★</span> Populares
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {popularTemplates.slice(0, 6).map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSelect={handleSelectTemplate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All/Filtered templates */}
          <div>
            {showPopular && (
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Todos os cartões
              </p>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {(showPopular ? cardTemplates.filter(t => !t.popular) : filteredTemplates).map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={handleSelectTemplate}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface TemplateCardProps {
  template: CardTemplate
  onSelect: (template: CardTemplate) => void
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className="flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:shadow-sm transition-all text-left group overflow-hidden p-2"
    >
      {/* Card preview - mini credit card look */}
      <div
        className="w-full rounded flex items-center justify-between px-2 h-10"
        style={{ backgroundColor: template.color }}
      >
        <BankLogo bankId={template.bank_id} size="md" className="w-6 h-6" />
        <CardBrandLogo brandId={template.brand_id} size="sm" className="w-8 h-5" />
      </div>

      {/* Card info */}
      <div className="mt-1.5 min-w-0">
        <p className="text-[11px] font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">
          {template.name}
        </p>
      </div>
    </button>
  )
}
