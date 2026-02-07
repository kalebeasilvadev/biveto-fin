import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, ChevronLeft, Eye, EyeOff, Lock } from 'lucide-react'
import { clsx } from 'clsx'
import {
  creditCardSchema,
  CreditCardFormData,
  CreditCard,
  pointsPrograms,
  defaultColors,
} from '../../schemas/creditCard.schema'
import { cardBrands as cardBrandsData } from '../../data/cardBrands'
import { CardTemplate } from '../../data/cardTemplates'
import { getBankById } from '../../data/banks'
import CurrencyInput from '../shared/CurrencyInput'
import OwnershipSelector from '../shared/OwnershipSelector'
import BankSelector from '../shared/BankSelector'
import CardBrandLogo from '../shared/CardBrandLogo'
import CardTemplateSelector from './CardTemplateSelector'

interface CreditCardModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreditCardFormData, invoicePassword?: string) => void
  editingCard?: CreditCard | null
  isLoading?: boolean
  error?: string | null
  showOwnershipSelector?: boolean
}

type ModalStep = 'template' | 'form'

export default function CreditCardModal({
  isOpen,
  onClose,
  onSubmit,
  editingCard,
  isLoading = false,
  error,
  showOwnershipSelector = false,
}: CreditCardModalProps) {
  const [step, setStep] = useState<ModalStep>('template')
  const [showPassword, setShowPassword] = useState(false)
  const [invoicePassword, setInvoicePassword] = useState('')

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreditCardFormData>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: {
      name: '',
      nickname: null,
      bank_id: null,
      credit_limit: 0,
      initial_balance: 0,
      closing_day: 1,
      due_day: 10,
      has_points: false,
      points_program: null,
      points_factor: 1,
      card_brand: null,
      card_variant: null,
      last_four_digits: null,
      annual_fee: null,
      annual_fee_frequency: 'monthly',
      annual_fee_waived: false,
      benefits_notes: null,
      color: '#1e1e1e',
      ownership_type: 'personal',
    },
  })

  const hasPoints = watch('has_points')
  const annualFeeWaived = watch('annual_fee_waived')
  const selectedColor = watch('color')

  // Wrapper to include invoice password in submit
  const handleFormSubmit = (data: CreditCardFormData) => {
    onSubmit(data, invoicePassword || undefined)
  }

  // Reset form when modal opens/closes or editingCard changes
  useEffect(() => {
    if (isOpen) {
      if (editingCard) {
        // Editing mode - go directly to form
        setStep('form')
        reset({
          name: editingCard.name,
          nickname: editingCard.nickname,
          bank_id: editingCard.bank_id,
          credit_limit: editingCard.credit_limit,
          initial_balance: 0,
          closing_day: editingCard.closing_day,
          due_day: editingCard.due_day,
          has_points: editingCard.has_points,
          points_program: editingCard.points_program,
          points_factor: editingCard.points_factor ?? 1,
          card_brand: editingCard.card_brand,
          card_variant: editingCard.card_variant,
          last_four_digits: editingCard.last_four_digits,
          annual_fee: editingCard.annual_fee,
          annual_fee_frequency: editingCard.annual_fee_frequency || 'monthly',
          annual_fee_waived: editingCard.annual_fee_waived || false,
          benefits_notes: null,
          color: editingCard.color || '#1e1e1e',
          ownership_type: 'personal',
        })
      } else {
        // New card - show template selector first
        setStep('template')
        reset({
          name: '',
          nickname: null,
          bank_id: null,
          credit_limit: 0,
          initial_balance: 0,
          closing_day: 1,
          due_day: 10,
          has_points: false,
          points_program: null,
          points_factor: 1,
          card_brand: null,
          card_variant: null,
          last_four_digits: null,
          annual_fee: null,
          annual_fee_frequency: 'monthly',
          annual_fee_waived: false,
          benefits_notes: null,
          color: '#1e1e1e',
          ownership_type: 'personal',
        })
      }
    }
  }, [isOpen, editingCard, reset])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleTemplateSelect = (template: CardTemplate | null) => {
    if (template) {
      // Get bank info for color
      const bank = getBankById(template.bank_id)
      reset({
        name: template.name,
        nickname: null,
        bank_id: template.bank_id,
        credit_limit: 0,
        initial_balance: 0,
        closing_day: 1,
        due_day: 10,
        has_points: template.has_points,
        points_program: template.points_program,
        points_factor: template.points_factor,
        card_brand: template.brand_id,
        card_variant: template.variant,
        last_four_digits: null,
        annual_fee: template.annual_fee,
        annual_fee_frequency: template.annual_fee_frequency,
        annual_fee_waived: template.annual_fee_waived,
        benefits_notes: null,
        color: template.color || bank?.color || '#1e1e1e',
        ownership_type: 'personal',
      })
    }
    setStep('form')
  }

  const handleSkipTemplate = () => {
    setStep('form')
  }

  const handleBackToTemplate = () => {
    setStep('template')
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {step === 'form' && !editingCard && (
              <button
                type="button"
                onClick={handleBackToTemplate}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingCard ? 'Editar Cartão' : step === 'template' ? 'Novo Cartão' : 'Dados do Cartão'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {step === 'template' && !editingCard ? (
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            <CardTemplateSelector onSelect={handleTemplateSelect} onSkip={handleSkipTemplate} />
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleFormSubmit)} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Banco */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Banco
              </label>
              <Controller
                name="bank_id"
                control={control}
                render={({ field }) => (
                  <BankSelector
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Selecione o banco"
                  />
                )}
              />
            </div>

            {/* Nome do Cartão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome do Cartão *
              </label>
              <input
                type="text"
                {...register('name')}
                className={clsx('input', errors.name && 'border-red-500')}
                placeholder="Ex: Nubank Ultravioleta"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Apelido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Apelido (opcional)
              </label>
              <input
                type="text"
                {...register('nickname')}
                className="input"
                placeholder="Ex: Roxinho, Cartão do trabalho"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Como você quer chamar esse cartão?
              </p>
            </div>

            {/* Bandeira e Variante */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bandeira
                </label>
                <Controller
                  name="card_brand"
                  control={control}
                  render={({ field }) => (
                    <div className="relative">
                      <select
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        className="input w-full pr-10"
                      >
                        <option value="">Selecione</option>
                        {cardBrandsData.filter(b => !b.category || b.category === 'credit').map((brand) => (
                          <option key={brand.id} value={brand.id}>{brand.name}</option>
                        ))}
                      </select>
                      {field.value && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                          <CardBrandLogo brandId={field.value} size="sm" />
                        </div>
                      )}
                    </div>
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Variante
                </label>
                <input
                  type="text"
                  {...register('card_variant')}
                  className="input"
                  placeholder="Platinum, Black..."
                />
              </div>
            </div>

            {/* Limite e Últimos 4 dígitos */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Limite *
                </label>
                <Controller
                  name="credit_limit"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value}
                      onChange={(val) => field.onChange(val ?? 0)}
                      error={!!errors.credit_limit}
                    />
                  )}
                />
                {errors.credit_limit && (
                  <p className="text-red-500 text-sm mt-1">{errors.credit_limit.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Final (4 dígitos)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  {...register('last_four_digits')}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    setValue('last_four_digits', value || null)
                  }}
                  className="input"
                  placeholder="1234"
                />
                {errors.last_four_digits && (
                  <p className="text-red-500 text-sm mt-1">{errors.last_four_digits.message}</p>
                )}
              </div>
            </div>

            {/* Ciclo de Faturamento */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dia de Fechamento
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  {...register('closing_day', { valueAsNumber: true })}
                  className={clsx('input', errors.closing_day && 'border-red-500')}
                />
                {errors.closing_day && (
                  <p className="text-red-500 text-sm mt-1">{errors.closing_day.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dia de Vencimento
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  {...register('due_day', { valueAsNumber: true })}
                  className={clsx('input', errors.due_day && 'border-red-500')}
                />
                {errors.due_day && (
                  <p className="text-red-500 text-sm mt-1">{errors.due_day.message}</p>
                )}
              </div>
            </div>

            {/* Programa de Pontos */}
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register('has_points')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Acumula pontos
                </span>
              </label>

              {hasPoints && (
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Programa
                    </label>
                    <select
                      {...register('points_program')}
                      className="input"
                    >
                      <option value="">Selecione</option>
                      {pointsPrograms.map((program) => (
                        <option key={program.value} value={program.value}>{program.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Fator (pts/R$)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      {...register('points_factor', { valueAsNumber: true })}
                      className="input"
                      placeholder="1.0"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Cor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cor do Cartão
              </label>
              <div className="flex gap-2">
                {defaultColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue('color', color)}
                    className={clsx(
                      'w-8 h-8 rounded-full transition-transform',
                      selectedColor === color && 'ring-2 ring-offset-2 ring-primary-500 scale-110'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Anuidade */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Anuidade
                  </label>
                  <Controller
                    name="annual_fee"
                    control={control}
                    render={({ field }) => (
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        disabled={annualFeeWaived}
                        placeholder="0,00"
                      />
                    )}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cobrança
                  </label>
                  <select
                    {...register('annual_fee_frequency')}
                    disabled={annualFeeWaived}
                    className="input disabled:opacity-50"
                  >
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register('annual_fee_waived')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Anuidade isenta</span>
              </label>
            </div>

            {/* Benefícios/Observações */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Benefícios/Observações
              </label>
              <textarea
                {...register('benefits_notes')}
                className="input"
                rows={2}
                placeholder="Sala VIP, seguro viagem..."
              />
              {errors.benefits_notes && (
                <p className="text-red-500 text-sm mt-1">{errors.benefits_notes.message}</p>
              )}
            </div>

            {/* Senha do PDF da Fatura */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Lock size={18} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    Senha do PDF da Fatura (opcional)
                  </label>
                  <p className="text-xs text-blue-900 dark:text-blue-200 mb-2">
                    Alguns bancos protegem PDFs de fatura com senha (CPF, data de nascimento, etc.).
                    Salve aqui para facilitar uploads futuros.
                  </p>
                  {editingCard?.has_invoice_password && !invoicePassword && (
                    <p className="text-xs text-green-700 dark:text-green-300 mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Senha já configurada. Deixe em branco para manter ou digite uma nova para alterar.
                    </p>
                  )}
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={invoicePassword}
                      onChange={(e) => setInvoicePassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-biveto focus:border-transparent text-sm"
                      placeholder="Digite a senha do PDF"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    <strong>Esta senha é apenas para desbloquear o PDF.</strong> Não tem relação com a senha do cartão ou conta bancária.
                  </p>
                </div>
              </div>
            </div>

            {/* Ownership Selector */}
            {showOwnershipSelector && (
              <Controller
                name="ownership_type"
                control={control}
                render={({ field }) => (
                  <OwnershipSelector
                    value={field.value}
                    onChange={field.onChange}
                    description="Cartões familiares são compartilhados com todos os membros"
                  />
                )}
              />
            )}

            {/* Error message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2 pt-4">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary flex-1"
              >
                {isLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
