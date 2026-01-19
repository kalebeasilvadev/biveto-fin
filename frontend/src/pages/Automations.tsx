import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Bell,
  ArrowRightLeft,
  Tag,
  Receipt,
  ChevronDown,
  ChevronUp,
  History,
  TestTube,
  X,
} from 'lucide-react'
import { automationsApi, accountsApi, categoriesApi } from '../services/api'
import { HelpButton } from '../components/help'
import { useToastStore } from '../stores/toastStore'

interface AutomationRule {
  id: number
  name: string
  description: string | null
  trigger_type: string
  trigger_config: Record<string, unknown>
  conditions: Record<string, unknown>
  action_type: string
  action_config: Record<string, unknown>
  is_active: boolean
  priority: number
  last_executed_at: string | null
  execution_count: number
  last_error: string | null
  consecutive_failures: number
  auto_disabled_at: string | null
  created_at: string
  trigger_summary: string | null
  action_summary: string | null
}

interface AutomationExecution {
  id: number
  rule_id: number
  executed_at: string
  trigger_reason: string
  status: string
  result_data: Record<string, unknown> | null
  error_message: string | null
  conditions_met: boolean | null
  duration_ms: number | null
}

interface Account {
  id: number
  name: string
  type: string
  balance: number
}

interface Category {
  id: number
  name: string
  type: string
}

const triggerTypeLabels: Record<string, string> = {
  schedule: 'Agendado',
  event: 'Evento',
  threshold: 'Limite',
}

const actionTypeLabels: Record<string, string> = {
  transfer: 'Transferência',
  categorize: 'Categorizar',
  notify: 'Notificação',
  tag: 'Tag',
  generate: 'Criar Transação',
}

const triggerTypeIcons: Record<string, typeof Clock> = {
  schedule: Clock,
  event: Zap,
  threshold: AlertCircle,
}

const actionTypeIcons: Record<string, typeof ArrowRightLeft> = {
  transfer: ArrowRightLeft,
  categorize: Tag,
  notify: Bell,
  tag: Tag,
  generate: Receipt,
}

function AutomationCard({
  rule,
  onToggle,
  onDelete,
  onTest,
  onExecute,
  onShowHistory,
}: {
  rule: AutomationRule
  onToggle: () => void
  onDelete: () => void
  onTest: () => void
  onExecute: () => void
  onShowHistory: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const TriggerIcon = triggerTypeIcons[rule.trigger_type] || Clock
  const ActionIcon = actionTypeIcons[rule.action_type] || Zap

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca'
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all ${
        rule.is_active
          ? 'border-gray-100 dark:border-slate-700'
          : 'border-gray-200 dark:border-slate-600 opacity-60'
      }`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={`p-2 rounded-xl ${
                rule.is_active
                  ? 'bg-biveto-light dark:bg-biveto/20 text-biveto'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-400'
              }`}
            >
              <Zap size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {rule.name}
              </h3>
              {rule.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                  {rule.description}
                </p>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {rule.auto_disabled_at && (
              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg">
                Auto-desativado
              </span>
            )}
            {rule.consecutive_failures > 0 && !rule.auto_disabled_at && (
              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-lg">
                {rule.consecutive_failures} falha(s)
              </span>
            )}
          </div>
        </div>

        {/* Trigger & Action Summary */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <TriggerIcon size={14} />
            <span>{rule.trigger_summary || triggerTypeLabels[rule.trigger_type]}</span>
          </div>
          <span className="text-gray-300 dark:text-gray-600">→</span>
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <ActionIcon size={14} />
            <span>{rule.action_summary || actionTypeLabels[rule.action_type]}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>Execuções: {rule.execution_count}</span>
          <span>Última: {formatDate(rule.last_executed_at)}</span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`btn btn-sm ${
              rule.is_active
                ? 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600'
                : 'bg-biveto text-white hover:bg-biveto-dark'
            }`}
          >
            {rule.is_active ? (
              <>
                <Pause size={14} /> Pausar
              </>
            ) : (
              <>
                <Play size={14} /> Ativar
              </>
            )}
          </button>
          <button
            onClick={onExecute}
            className="btn btn-sm bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
            disabled={!rule.is_active}
          >
            <Play size={14} /> Executar
          </button>
          <button
            onClick={onTest}
            className="btn btn-sm bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <TestTube size={14} /> Testar
          </button>
          <button
            onClick={onShowHistory}
            className="btn btn-sm bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <History size={14} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn btn-sm bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 ml-auto"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={onDelete}
            className="btn btn-sm bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-900/50 rounded-b-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gatilho ({triggerTypeLabels[rule.trigger_type]})
              </h4>
              <pre className="text-xs bg-white dark:bg-slate-800 p-2 rounded-lg overflow-x-auto">
                {JSON.stringify(rule.trigger_config, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ação ({actionTypeLabels[rule.action_type]})
              </h4>
              <pre className="text-xs bg-white dark:bg-slate-800 p-2 rounded-lg overflow-x-auto">
                {JSON.stringify(rule.action_config, null, 2)}
              </pre>
            </div>
          </div>
          {rule.last_error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                <strong>Último erro:</strong> {rule.last_error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CreateAutomationModal({
  isOpen,
  onClose,
  accounts,
  categories: _categories,
}: {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  categories: Category[]
}) {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('schedule')
  const [actionType, setActionType] = useState('transfer')

  // Schedule config
  const [frequency, setFrequency] = useState('monthly')
  const [dayOfMonth, setDayOfMonth] = useState(5)
  const [scheduleTime, setScheduleTime] = useState('08:00')

  // Transfer config
  const [fromAccountId, setFromAccountId] = useState<number | null>(null)
  const [toAccountId, setToAccountId] = useState<number | null>(null)
  const [amountType, setAmountType] = useState('percentage')
  const [amountValue, setAmountValue] = useState(20)
  const [transferDescription, setTransferDescription] = useState('Transferência automática')

  // Notify config
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof automationsApi.create>[0]) =>
      automationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      addToast('Automação criada com sucesso!', 'success')
      onClose()
      resetForm()
    },
    onError: () => {
      addToast('Erro ao criar automação', 'error')
    },
  })

  const resetForm = () => {
    setName('')
    setDescription('')
    setTriggerType('schedule')
    setActionType('transfer')
    setFrequency('monthly')
    setDayOfMonth(5)
    setScheduleTime('08:00')
    setFromAccountId(null)
    setToAccountId(null)
    setAmountType('percentage')
    setAmountValue(20)
    setTransferDescription('Transferência automática')
    setNotifyTitle('')
    setNotifyMessage('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const triggerConfig: Record<string, unknown> = {}
    if (triggerType === 'schedule') {
      triggerConfig.frequency = frequency
      triggerConfig.time = scheduleTime
      if (frequency === 'monthly') {
        triggerConfig.day_of_month = dayOfMonth
      }
    }

    const actionConfig: Record<string, unknown> = {}
    if (actionType === 'transfer') {
      actionConfig.from_account_id = fromAccountId
      actionConfig.to_account_id = toAccountId
      actionConfig.amount_type = amountType
      actionConfig.amount_value = amountValue
      actionConfig.description = transferDescription
    } else if (actionType === 'notify') {
      actionConfig.title = notifyTitle
      actionConfig.message = notifyMessage
      actionConfig.channels = ['in_app']
    }

    createMutation.mutate({
      name,
      description: description || undefined,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      action_type: actionType,
      action_config: actionConfig,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Nova Automação
          </h2>
          <button onClick={onClose} className="btn-icon">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder="Ex: Transferir 20% para reserva"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full"
              rows={2}
              placeholder="Descrição da automação..."
            />
          </div>

          {/* Trigger Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Gatilho
            </label>
            <div className="flex gap-2">
              {['schedule', 'threshold'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTriggerType(type)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    triggerType === type
                      ? 'bg-biveto text-white border-biveto'
                      : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600'
                  }`}
                >
                  {triggerTypeLabels[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Config */}
          {triggerType === 'schedule' && (
            <div className="space-y-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Frequência
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="input w-full text-sm"
                  >
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>
                {frequency === 'monthly' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Dia do mês
                    </label>
                    <input
                      type="number"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                      min={1}
                      max={31}
                      className="input w-full text-sm"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Horário
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
            </div>
          )}

          {/* Action Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ação
            </label>
            <div className="flex gap-2">
              {['transfer', 'notify'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActionType(type)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    actionType === type
                      ? 'bg-biveto text-white border-biveto'
                      : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600'
                  }`}
                >
                  {actionTypeLabels[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Transfer Config */}
          {actionType === 'transfer' && (
            <div className="space-y-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Conta Origem
                  </label>
                  <select
                    value={fromAccountId || ''}
                    onChange={(e) => setFromAccountId(parseInt(e.target.value))}
                    className="input w-full text-sm"
                    required
                  >
                    <option value="">Selecione...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Conta Destino
                  </label>
                  <select
                    value={toAccountId || ''}
                    onChange={(e) => setToAccountId(parseInt(e.target.value))}
                    className="input w-full text-sm"
                    required
                  >
                    <option value="">Selecione...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Tipo de valor
                  </label>
                  <select
                    value={amountType}
                    onChange={(e) => setAmountType(e.target.value)}
                    className="input w-full text-sm"
                  >
                    <option value="fixed">Valor fixo (R$)</option>
                    <option value="percentage">Percentual (%)</option>
                    <option value="remaining">Saldo restante</option>
                  </select>
                </div>
                {amountType !== 'remaining' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      {amountType === 'fixed' ? 'Valor (R$)' : 'Percentual (%)'}
                    </label>
                    <input
                      type="number"
                      value={amountValue}
                      onChange={(e) => setAmountValue(parseFloat(e.target.value))}
                      min={0}
                      step={amountType === 'fixed' ? 0.01 : 1}
                      className="input w-full text-sm"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Descrição da transferência
                </label>
                <input
                  type="text"
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
            </div>
          )}

          {/* Notify Config */}
          {actionType === 'notify' && (
            <div className="space-y-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                  className="input w-full text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Mensagem
                </label>
                <textarea
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  className="input w-full text-sm"
                  rows={2}
                  required
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn flex-1 bg-biveto text-white hover:bg-biveto-dark"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar Automação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ExecutionHistoryModal({
  isOpen,
  onClose,
  ruleId,
  ruleName,
}: {
  isOpen: boolean
  onClose: () => void
  ruleId: number | null
  ruleName: string
}) {
  const { data: executions, isLoading } = useQuery({
    queryKey: ['automation-executions', ruleId],
    queryFn: () => automationsApi.getRuleExecutions(ruleId!, 20),
    enabled: isOpen && ruleId !== null,
  })

  if (!isOpen) return null

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />
      case 'failed':
        return <XCircle size={16} className="text-red-500" />
      case 'skipped':
        return <AlertCircle size={16} className="text-yellow-500" />
      default:
        return <Clock size={16} className="text-gray-400" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success':
        return 'Sucesso'
      case 'failed':
        return 'Falhou'
      case 'skipped':
        return 'Ignorado'
      default:
        return status
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Histórico: {ruleName}
          </h2>
          <button onClick={onClose} className="btn-icon">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-biveto"></div>
            </div>
          ) : executions?.data?.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <History size={48} className="mx-auto mb-3 opacity-50" />
              <p>Nenhuma execução registrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {executions?.data?.map((exec: AutomationExecution) => (
                <div
                  key={exec.id}
                  className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(exec.status)}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {getStatusLabel(exec.status)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(exec.executed_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Gatilho:</span> {exec.trigger_reason}
                  </div>
                  {exec.duration_ms && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Duração: {exec.duration_ms}ms
                    </div>
                  )}
                  {exec.error_message && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">
                      {exec.error_message}
                    </div>
                  )}
                  {exec.result_data && (
                    <pre className="mt-2 text-xs bg-white dark:bg-slate-800 p-2 rounded-lg overflow-x-auto">
                      {JSON.stringify(exec.result_data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Automations() {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null)
  const [includeInactive, setIncludeInactive] = useState(false)

  const { data: automationsData, isLoading } = useQuery({
    queryKey: ['automations', includeInactive],
    queryFn: () => automationsApi.list({ include_inactive: includeInactive }),
  })

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => automationsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      addToast('Automação atualizada', 'success')
    },
    onError: () => {
      addToast('Erro ao atualizar automação', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => automationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      addToast('Automação removida', 'success')
    },
    onError: () => {
      addToast('Erro ao remover automação', 'error')
    },
  })

  const testMutation = useMutation({
    mutationFn: (id: number) => automationsApi.test(id),
    onSuccess: (response) => {
      const result = response.data
      if (result.would_execute) {
        addToast('Teste: automação seria executada', 'success')
      } else {
        addToast('Teste: condições não atendidas', 'info')
      }
    },
    onError: () => {
      addToast('Erro ao testar automação', 'error')
    },
  })

  const executeMutation = useMutation({
    mutationFn: (id: number) => automationsApi.execute(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      const result = response.data
      if (result.status === 'success') {
        addToast('Automação executada com sucesso', 'success')
      } else if (result.status === 'skipped') {
        addToast('Automação ignorada (condições não atendidas)', 'info')
      } else {
        addToast('Erro na execução da automação', 'error')
      }
    },
    onError: () => {
      addToast('Erro ao executar automação', 'error')
    },
  })

  const rules: AutomationRule[] = automationsData?.data?.rules || []
  const accounts: Account[] = accountsData?.data || []
  const categories: Category[] = categoriesData?.data || []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Automações
            </h1>
            <HelpButton pageId="automations" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Regras automáticas para suas finanças
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn bg-biveto text-white hover:bg-biveto-dark"
        >
          <Plus size={18} />
          Nova Automação
        </button>
      </div>

      {/* Stats */}
      {automationsData?.data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-biveto-light dark:bg-biveto/20 rounded-xl">
                <Zap size={20} className="text-biveto" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {automationsData.data.total}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-xl">
                <CheckCircle size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {automationsData.data.active_count}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Ativas</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-xl">
                <Pause size={20} className="text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {automationsData.data.disabled_count}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Inativas</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-gray-300 dark:border-slate-600 text-biveto focus:ring-biveto"
          />
          Mostrar inativas
        </label>
      </div>

      {/* Rules List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-biveto"></div>
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-gray-100 dark:border-slate-700">
          <Zap size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Nenhuma automação
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Crie sua primeira automação para automatizar suas finanças
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn bg-biveto text-white hover:bg-biveto-dark"
          >
            <Plus size={18} />
            Criar Automação
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <AutomationCard
              key={rule.id}
              rule={rule}
              onToggle={() => toggleMutation.mutate(rule.id)}
              onDelete={() => {
                if (confirm('Tem certeza que deseja excluir esta automação?')) {
                  deleteMutation.mutate(rule.id)
                }
              }}
              onTest={() => testMutation.mutate(rule.id)}
              onExecute={() => executeMutation.mutate(rule.id)}
              onShowHistory={() => {
                setSelectedRule(rule)
                setShowHistoryModal(true)
              }}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateAutomationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        accounts={accounts}
        categories={categories}
      />

      {/* History Modal */}
      <ExecutionHistoryModal
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false)
          setSelectedRule(null)
        }}
        ruleId={selectedRule?.id || null}
        ruleName={selectedRule?.name || ''}
      />
    </div>
  )
}
