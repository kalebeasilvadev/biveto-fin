import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  ArrowLeft,
  Shield,
  Clock,
  Eye,
  EyeOff,
  Ban,
  BookOpen,
  Terminal,
  Bot,
  Puzzle,
  ChevronDown,
} from 'lucide-react'
import { apiKeysApi, familyApi, getApiErrorMessage } from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ApiKey {
  id: number
  name: string
  key_prefix: string
  status: string
  can_read: boolean
  can_write: boolean
  last_used_at: string | null
  expires_at: string | null
  usage_count: number
  created_at: string
}

interface ApiKeyCreated {
  id: number
  name: string
  api_key: string
  key_prefix: string
  expires_at: string | null
  created_at: string
}

export default function ApiKeys() {
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyNotes, setNewKeyNotes] = useState('')
  const [newKeyExpires, setNewKeyExpires] = useState<number | ''>('')
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [openTutorial, setOpenTutorial] = useState<string | null>(null)

  const toggleTutorial = (id: string) => {
    setOpenTutorial(openTutorial === id ? null : id)
  }

  // Verifica se é owner
  const { data: familyContext, isLoading: isLoadingContext } = useQuery({
    queryKey: ['family-context'],
    queryFn: async () => {
      const response = await familyApi.getContext()
      return response.data as { is_owner: boolean }
    },
  })

  // Lista API Keys
  const { data: apiKeysData, isLoading: isLoadingKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await apiKeysApi.list()
      return response.data as { items: ApiKey[]; total: number }
    },
    enabled: familyContext?.is_owner,
  })

  // Criar API Key
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; notes?: string; expires_in_days?: number }) => {
      const response = await apiKeysApi.create(data)
      return response.data as ApiKeyCreated
    },
    onSuccess: (data) => {
      setCreatedKey(data)
      setShowCreateForm(false)
      setNewKeyName('')
      setNewKeyNotes('')
      setNewKeyExpires('')
      setError('')
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Erro ao criar API Key'))
    },
  })

  // Revogar API Key
  const revokeMutation = useMutation({
    mutationFn: (id: number) => apiKeysApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Erro ao revogar API Key'))
    },
  })

  // Deletar API Key
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiKeysApi.delete(id),
    onSuccess: () => {
      setDeleteConfirmId(null)
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Erro ao deletar API Key'))
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!newKeyName.trim()) {
      setError('Digite um nome para a API Key')
      return
    }

    createMutation.mutate({
      name: newKeyName.trim(),
      notes: newKeyNotes.trim() || undefined,
      expires_in_days: newKeyExpires ? Number(newKeyExpires) : undefined,
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  if (isLoadingContext) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-biveto"></div>
      </div>
    )
  }

  if (!familyContext?.is_owner) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <Shield size={48} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Acesso Restrito
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Apenas o proprietário da conta pode gerenciar API Keys.
          </p>
          <Link to="/settings" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={18} />
            Voltar para Configurações
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              to="/settings"
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Keys</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 ml-11">
            Gerencie chaves de API para integração com Claude Code e outras ferramentas
          </p>
        </div>
        {!showCreateForm && !createdKey && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Nova API Key
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Modal de chave criada */}
      {createdKey && (
        <div className="card border-2 border-green-500 dark:border-green-400">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Check size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                API Key Criada!
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Guarde esta chave em local seguro. Ela não será mostrada novamente.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Sua API Key:</span>
              <button
                onClick={() => setShowKey(!showKey)}
                className="text-sm text-biveto dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                {showKey ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-200 dark:border-slate-600 font-mono text-sm break-all">
                {showKey ? createdKey.api_key : '•'.repeat(36)}
              </code>
              <button
                onClick={() => copyToClipboard(createdKey.api_key)}
                className={`p-2 rounded-lg transition-colors ${
                  copiedKey
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-500'
                }`}
                title="Copiar"
              >
                {copiedKey ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Importante:</strong> Esta chave só é mostrada uma vez. Se você perdê-la,
              precisará criar uma nova.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setCreatedKey(null)}
              className="btn-primary flex-1"
            >
              Entendi, guardei a chave
            </button>
          </div>
        </div>
      )}

      {/* Formulário de criação */}
      {showCreateForm && !createdKey && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Criar Nova API Key
          </h2>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome *
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="input"
                placeholder="Ex: Claude Code - MacBook"
                maxLength={100}
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Um nome para identificar onde você usa esta chave
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Observações (opcional)
              </label>
              <textarea
                value={newKeyNotes}
                onChange={(e) => setNewKeyNotes(e.target.value)}
                className="input"
                placeholder="Anotações sobre o uso desta chave..."
                rows={2}
                maxLength={500}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expiração (opcional)
              </label>
              <select
                value={newKeyExpires}
                onChange={(e) => setNewKeyExpires(e.target.value ? Number(e.target.value) : '')}
                className="input"
              >
                <option value="">Nunca expira</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
                <option value="180">180 dias</option>
                <option value="365">1 ano</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setNewKeyName('')
                  setNewKeyNotes('')
                  setNewKeyExpires('')
                  setError('')
                }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Criando...' : 'Criar API Key'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de API Keys */}
      {!showCreateForm && !createdKey && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Suas API Keys
          </h2>

          {isLoadingKeys ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-biveto"></div>
            </div>
          ) : !apiKeysData?.items?.length ? (
            <div className="text-center py-8">
              <Key size={40} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                Você ainda não tem nenhuma API Key.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Crie uma para usar com Claude Code ou outras integrações.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeysData.items.map((key) => (
                <div
                  key={key.id}
                  className={`p-4 rounded-lg border ${
                    key.status === 'active'
                      ? 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50'
                      : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Key size={16} className="text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {key.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            key.status === 'active'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}
                        >
                          {key.status === 'active' ? 'Ativa' : 'Revogada'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-mono">{key.key_prefix}...</span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {key.last_used_at
                            ? `Usado ${formatDistanceToNow(new Date(key.last_used_at), { locale: ptBR, addSuffix: true })}`
                            : 'Nunca usado'}
                        </span>
                        {key.expires_at && (
                          <span className="text-amber-600 dark:text-amber-400">
                            Expira em {formatDistanceToNow(new Date(key.expires_at), { locale: ptBR })}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Criada {formatDistanceToNow(new Date(key.created_at), { locale: ptBR, addSuffix: true })}
                        {key.usage_count > 0 && ` • ${key.usage_count} usos`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {key.status === 'active' && (
                        <button
                          onClick={() => revokeMutation.mutate(key.id)}
                          disabled={revokeMutation.isPending}
                          className="p-2 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                          title="Revogar"
                        >
                          <Ban size={18} />
                        </button>
                      )}
                      {deleteConfirmId === key.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteMutation.mutate(key.id)}
                            disabled={deleteMutation.isPending}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(key.id)}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Deletar"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tutoriais de Integração */}
      {!showCreateForm && !createdKey && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BookOpen size={20} />
            Tutoriais de Integração
          </h2>

          <div className="space-y-3">
            {/* Claude Code */}
            <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleTutorial('claude-code')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <Terminal size={20} className="text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900 dark:text-white">Claude Code</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">MCP Server para análise de dados</p>
                  </div>
                </div>
                <ChevronDown
                  size={20}
                  className={`text-gray-400 transition-transform ${openTutorial === 'claude-code' ? 'rotate-180' : ''}`}
                />
              </button>
              {openTutorial === 'claude-code' && (
                <div className="p-4 border-t border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm space-y-3">
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>1.</strong> Crie uma API Key acima e guarde-a em local seguro
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>2.</strong> Clone ou baixe o MCP Server do Biveto
                  </p>
                  <pre className="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg overflow-x-auto text-xs">
{`git clone https://github.com/biveto/mcp-biveto-db.git
cd mcp-biveto-db
pip install -r requirements.txt`}
                  </pre>
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>3.</strong> Configure no arquivo <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">.mcp.json</code> do seu projeto:
                  </p>
                  <pre className="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg overflow-x-auto text-xs">
{`{
  "mcpServers": {
    "biveto-db": {
      "command": "python",
      "args": ["/caminho/para/mcp-biveto-db/server.py"],
      "env": {
        "BIVETO_API_URL": "https://biveto.com/api/v1",
        "BIVETO_API_KEY": "biv_sua_chave_aqui"
      }
    }
  }
}`}
                  </pre>
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>4.</strong> Reinicie o Claude Code para carregar as novas configurações
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-3">
                    <p className="text-blue-800 dark:text-blue-200 text-xs">
                      <strong>Comandos disponíveis:</strong> list_tables, describe_table, query, get_summary, get_table_stats
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ChatGPT / Custom GPT */}
            <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleTutorial('chatgpt')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Bot size={20} className="text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900 dark:text-white">ChatGPT / Custom GPTs</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Actions para GPTs personalizados</p>
                  </div>
                </div>
                <ChevronDown
                  size={20}
                  className={`text-gray-400 transition-transform ${openTutorial === 'chatgpt' ? 'rotate-180' : ''}`}
                />
              </button>
              {openTutorial === 'chatgpt' && (
                <div className="p-4 border-t border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm space-y-3">
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>1.</strong> No ChatGPT, crie um novo GPT ou edite um existente
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>2.</strong> Vá em "Configure" → "Actions" → "Create new action"
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>3.</strong> Importe o schema OpenAPI:
                  </p>
                  <pre className="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg overflow-x-auto text-xs">
{`https://biveto.com/api/v1/mcp/openapi.json`}
                  </pre>
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>4.</strong> Em "Authentication", selecione "API Key" e configure:
                  </p>
                  <pre className="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg overflow-x-auto text-xs">
{`Auth Type: API Key
API Key: biv_sua_chave_aqui
Header Name: X-API-Key`}
                  </pre>
                  <p className="text-gray-700 dark:text-gray-300">
                    <strong>5.</strong> Salve e teste perguntando sobre suas finanças
                  </p>
                </div>
              )}
            </div>

            {/* API REST Direta */}
            <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleTutorial('api-rest')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Puzzle size={20} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900 dark:text-white">API REST / Outras Integrações</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Acesso direto via HTTP</p>
                  </div>
                </div>
                <ChevronDown
                  size={20}
                  className={`text-gray-400 transition-transform ${openTutorial === 'api-rest' ? 'rotate-180' : ''}`}
                />
              </button>
              {openTutorial === 'api-rest' && (
                <div className="p-4 border-t border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm space-y-3">
                  <p className="text-gray-700 dark:text-gray-300">
                    Use sua API Key no header <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">X-API-Key</code> para acessar os endpoints:
                  </p>

                  <div className="space-y-2">
                    <div className="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Listar tabelas disponíveis</p>
                      <code className="text-xs">GET /api/v1/mcp/tables</code>
                    </div>

                    <div className="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Consultar dados de uma tabela</p>
                      <code className="text-xs">POST /api/v1/mcp/query</code>
                      <pre className="text-xs mt-2 text-gray-600 dark:text-gray-300">
{`{
  "table": "transactions",
  "filters": {"type": "expense"},
  "limit": 100
}`}
                      </pre>
                    </div>

                    <div className="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Resumo financeiro</p>
                      <code className="text-xs">GET /api/v1/mcp/summary</code>
                    </div>
                  </div>

                  <p className="text-gray-700 dark:text-gray-300 mt-3">
                    <strong>Exemplo com cURL:</strong>
                  </p>
                  <pre className="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg overflow-x-auto text-xs">
{`curl -H "X-API-Key: biv_sua_chave_aqui" \\
  https://biveto.com/api/v1/mcp/summary`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
