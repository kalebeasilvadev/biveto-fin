import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, AlertCircle } from 'lucide-react'
import { useEffect } from 'react'
import {
  BenefitCard,
  BenefitCardFormData,
  benefitCardSchema,
  benefitCardTypes,
  benefitProviders,
  defaultBenefitColors,
} from '../../schemas/benefitCard.schema'
import { clsx } from 'clsx'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: BenefitCardFormData) => void
  editingCard: BenefitCard | null
  isLoading: boolean
  error: string | null
  showOwnershipSelector: boolean
}

export default function BenefitCardModal({
  isOpen,
  onClose,
  onSubmit,
  editingCard,
  isLoading,
  error,
  showOwnershipSelector,
}: Props) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<BenefitCardFormData>({
    resolver: zodResolver(benefitCardSchema),
    defaultValues: {
      name: '',
      card_type: 'va',
      provider: null,
      last_four_digits: null,
      initial_balance: 0,
      expected_monthly_recharge: null,
      recharge_day: null,
      linked_income_source_id: null,
      color: '#00A859',
      ownership_type: 'personal',
    },
  })

  const selectedProvider = watch('provider')
  const selectedType = watch('card_type')

  useEffect(() => {
    if (editingCard) {
      reset({
        name: editingCard.name,
        card_type: editingCard.card_type as 'va' | 'vr' | 'flex' | 'vt' | 'cultura' | 'combustivel',
        provider: editingCard.provider as 'alelo' | 'sodexo' | 'vr' | 'ticket' | 'flash' | 'ifood' | 'caju' | 'swile' | 'pluxee' | 'other' | null,
        last_four_digits: editingCard.last_four_digits || null,
        initial_balance: editingCard.current_balance || 0,
        expected_monthly_recharge: editingCard.expected_monthly_recharge || null,
        recharge_day: editingCard.recharge_day || null,
        color: editingCard.color || '#00A859',
        ownership_type: 'personal',
      })
    } else {
      reset({
        name: '',
        card_type: 'va',
        provider: null,
        last_four_digits: null,
        initial_balance: 0,
        expected_monthly_recharge: null,
        recharge_day: null,
        linked_income_source_id: null,
        color: '#00A859',
        ownership_type: 'personal',
      })
    }
  }, [editingCard, reset, isOpen])

  if (!isOpen) return null

  const providerColor = selectedProvider
    ? benefitProviders.find(p => p.value === selectedProvider)?.color
    : undefined

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingCard ? 'Editar Cartao de Beneficio' : 'Novo Cartao de Beneficio'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          {/* Tipo do cartao */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo do Cartao *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {benefitCardTypes.map((type) => (
                <label
                  key={type.value}
                  className={clsx(
                    'flex flex-col p-3 rounded-lg border cursor-pointer transition-all',
                    selectedType === type.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-300'
                  )}
                >
                  <input
                    type="radio"
                    value={type.value}
                    {...register('card_type')}
                    className="sr-only"
                  />
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {type.label}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {type.description}
                  </span>
                </label>
              ))}
            </div>
            {errors.card_type && (
              <p className="mt-1 text-sm text-red-500">{errors.card_type.message}</p>
            )}
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome do cartao *
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder="Ex: Alelo VA Empresa"
              className="input w-full"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Operadora */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Operadora
            </label>
            <div className="grid grid-cols-3 gap-2">
              {benefitProviders.map((provider) => (
                <label
                  key={provider.value}
                  className={clsx(
                    'flex items-center justify-center p-2 rounded-lg border cursor-pointer transition-all text-center',
                    selectedProvider === provider.value
                      ? 'border-2'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-300'
                  )}
                  style={selectedProvider === provider.value ? { borderColor: provider.color } : undefined}
                >
                  <input
                    type="radio"
                    value={provider.value}
                    {...register('provider')}
                    className="sr-only"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {provider.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Ultimos 4 digitos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ultimos 4 digitos
            </label>
            <input
              type="text"
              {...register('last_four_digits')}
              maxLength={4}
              placeholder="1234"
              className="input w-24"
            />
            {errors.last_four_digits && (
              <p className="mt-1 text-sm text-red-500">{errors.last_four_digits.message}</p>
            )}
          </div>

          {/* Saldo atual */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Saldo atual (R$)
            </label>
            <Controller
              name="initial_balance"
              control={control}
              render={({ field }) => (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  className="input w-full"
                  placeholder="0,00"
                />
              )}
            />
            {errors.initial_balance && (
              <p className="mt-1 text-sm text-red-500">{errors.initial_balance.message}</p>
            )}
          </div>

          {/* Recarga mensal esperada */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Recarga mensal (R$)
              </label>
              <Controller
                name="expected_monthly_recharge"
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                    className="input w-full"
                    placeholder="800,00"
                  />
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dia da recarga
              </label>
              <Controller
                name="recharge_day"
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    className="input w-full"
                    placeholder="5"
                  />
                )}
              />
            </div>
          </div>

          {/* Cor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cor do cartao
            </label>
            <div className="flex gap-2 flex-wrap">
              {defaultBenefitColors.map((c) => (
                <Controller
                  key={c}
                  name="color"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(c)}
                      className={clsx(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        field.value === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  )}
                />
              ))}
              {providerColor && !defaultBenefitColors.includes(providerColor as typeof defaultBenefitColors[number]) && (
                <Controller
                  name="color"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(providerColor)}
                      className={clsx(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        field.value === providerColor ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                      )}
                      style={{ backgroundColor: providerColor }}
                    />
                  )}
                />
              )}
            </div>
          </div>

          {/* Tipo de propriedade (para familias) */}
          {showOwnershipSelector && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Visibilidade
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="personal"
                    {...register('ownership_type')}
                    className="form-radio text-primary-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Pessoal</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="household"
                    {...register('ownership_type')}
                    className="form-radio text-primary-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Compartilhado</span>
                </label>
              </div>
            </div>
          )}

          {/* Botoes */}
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Salvando...' : editingCard ? 'Salvar' : 'Criar Cartao'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
