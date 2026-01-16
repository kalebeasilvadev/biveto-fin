import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, AlertTriangle, CheckCircle, Database, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'
import api from '../services/api'

interface MigrationPreview {
  accounts: number
  budgets: number
  goals: number
  debts: number
  recurring_transactions: number
  transactions: number
  income_sources: number
  total: number
}

interface FamilyContext {
  license_id: number
  license_type: string
  is_owner: boolean
  can_invite: boolean
  member_count: number
  max_members: number
}

// API calls using configured axios instance
const migrationApi = {
  getPreview: async (): Promise<MigrationPreview> => {
    const response = await api.get('/household/migration/preview')
    return response.data
  },

  migrate: async (): Promise<{ success: boolean; migrated: MigrationPreview; message: string }> => {
    const response = await api.post('/household/migration/migrate', { migrate_all: true })
    return response.data
  },

  getFamilyContext: async (): Promise<FamilyContext> => {
    const response = await api.get('/family/context')
    return response.data
  }
}

export default function HouseholdMigration() {
  const queryClient = useQueryClient()
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [migrationComplete, setMigrationComplete] = useState(false)

  const { data: familyData } = useQuery({
    queryKey: ['family-context'],
    queryFn: migrationApi.getFamilyContext
  })

  const { data: previewData, isLoading } = useQuery({
    queryKey: ['migration-preview'],
    queryFn: migrationApi.getPreview,
    enabled: familyData?.data?.is_owner === true
  })

  const migrateMutation = useMutation({
    mutationFn: migrationApi.migrate,
    onSuccess: () => {
      setMigrationComplete(true)
      setShowConfirmation(false)
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['income-sources'] })
      queryClient.invalidateQueries({ queryKey: ['migration-preview'] })
    }
  })

  const preview = previewData
  const family = familyData
  const isOwner = family?.is_owner === true
  const hasResources = preview && preview.total > 0

  if (!isOwner) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                Acesso Restrito
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Apenas o owner da família pode acessar a ferramenta de migração.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users size={28} />
          Tornar Familiar
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Compartilhe seus recursos com todos os membros da família
        </p>
      </div>

      {migrationComplete ? (
        /* Success State */
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-green-900 dark:text-green-100 text-lg mb-2">
                Recursos Compartilhados!
              </h3>
              <p className="text-green-800 dark:text-green-200 mb-4">
                Todos os recursos agora são visíveis para sua família.
                Os membros podem visualizar contas, faturas, orçamentos e muito mais.
              </p>
              <button
                onClick={() => {
                  setMigrationComplete(false)
                  queryClient.invalidateQueries({ queryKey: ['migration-preview'] })
                }}
                className="btn-secondary"
              >
                Verificar Novamente
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Info Card */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Users className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Como Funciona
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1.5 list-disc list-inside">
                  <li>Esta ferramenta converte recursos "Pessoais" para "Household" (Familiar)</li>
                  <li>Após a conversão, <strong>todos os membros da família</strong> poderão ver esses recursos</li>
                  <li>Isso inclui: Contas, Cartões, Faturas, Orçamentos, Metas, Dívidas, Transações, etc.</li>
                  <li>A operação é <strong>irreversível</strong> - não é possível converter de volta automaticamente</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Preview Card */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                  Recursos a Converter
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Visualize quantos recursos serão afetados pela migração
                </p>
              </div>

              {!hasResources ? (
                <div className="p-12 text-center">
                  <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Tudo Pronto!
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    Você não tem recursos pessoais para migrar. Todos já estão como "Household"!
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <ResourceCount label="Contas" count={preview.accounts} />
                      <ResourceCount label="Orçamentos" count={preview.budgets} />
                      <ResourceCount label="Metas" count={preview.goals} />
                      <ResourceCount label="Dívidas" count={preview.debts} />
                      <ResourceCount label="Recorrentes" count={preview.recurring_transactions} />
                      <ResourceCount label="Transações" count={preview.transactions} />
                      <ResourceCount label="Fontes Receita" count={preview.income_sources} />
                      <ResourceCount label="TOTAL" count={preview.total} highlight />
                    </div>
                  </div>

                  <div className="p-6 bg-gray-50 dark:bg-slate-700/30 border-t border-gray-200 dark:border-slate-700">
                    <button
                      onClick={() => setShowConfirmation(true)}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                      disabled={migrateMutation.isPending}
                    >
                      <ArrowRight size={20} />
                      Compartilhar com Família
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={24} />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2">
                  Confirmar Compartilhamento
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Você está prestes a compartilhar <strong>{preview?.total} recursos</strong> com sua família.
                </p>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-4">
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                    ⚠️ Esta ação não pode ser desfeita!
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Todos os membros da família poderão ver esses recursos.
                  </p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Tem certeza que deseja continuar?
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="btn-secondary flex-1"
                disabled={migrateMutation.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={() => migrateMutation.mutate()}
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
                disabled={migrateMutation.isPending}
              >
                {migrateMutation.isPending ? 'Compartilhando...' : 'Sim, Compartilhar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper component
function ResourceCount({
  label,
  count,
  highlight = false
}: {
  label: string
  count: number
  highlight?: boolean
}) {
  return (
    <div className={clsx(
      'p-4 rounded-lg text-center',
      highlight
        ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800'
        : 'bg-gray-50 dark:bg-slate-700/50'
    )}>
      <div className={clsx(
        'text-2xl font-bold mb-1',
        highlight
          ? 'text-primary-600 dark:text-primary-400'
          : 'text-gray-900 dark:text-white'
      )}>
        {count}
      </div>
      <div className={clsx(
        'text-xs',
        highlight
          ? 'text-primary-600 dark:text-primary-400 font-medium'
          : 'text-gray-600 dark:text-gray-400'
      )}>
        {label}
      </div>
    </div>
  )
}
