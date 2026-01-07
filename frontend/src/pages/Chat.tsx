import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { chatApi } from '../services/api'
import { Send, Bot, User, Loader2, Sparkles, TrendingUp, PiggyBank, CreditCard, Target } from 'lucide-react'
import { clsx } from 'clsx'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  dataUsed?: string[]
}

interface ChatResponse {
  message: string
  conversation_id: string
  suggestions: string[]
  data_used: string[]
}

const QUICK_ACTIONS = [
  { icon: TrendingUp, label: 'Gastos do mês', query: 'Quanto gastei esse mês? Detalhe por categoria.' },
  { icon: PiggyBank, label: 'Economias', query: 'Quanto consegui economizar? Como melhorar?' },
  { icon: CreditCard, label: 'Maiores gastos', query: 'Quais foram meus maiores gastos esse mês?' },
  { icon: Target, label: 'Minhas metas', query: 'Como estão minhas metas financeiras?' },
]

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: suggestionsData, isLoading: loadingSuggestions } = useQuery({
    queryKey: ['chat-suggestions'],
    queryFn: () => chatApi.getSuggestions(),
    staleTime: 5 * 60 * 1000,
  })

  const suggestions = suggestionsData?.data?.suggestions || []
  const welcomeMessage = suggestionsData?.data?.welcome_message || 'Olá! Como posso ajudar?'

  const sendMutation = useMutation({
    mutationFn: (message: string) => chatApi.sendMessage(message, conversationId || undefined),
    onSuccess: (response) => {
      const data: ChatResponse = response.data
      setConversationId(data.conversation_id)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          dataUsed: data.data_used,
        },
      ])
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
          timestamp: new Date(),
        },
      ])
    },
  })

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = (customMessage?: string) => {
    const messageToSend = customMessage || input.trim()
    if (!messageToSend || sendMutation.isPending) return

    if (!customMessage) setInput('')

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: messageToSend,
        timestamp: new Date(),
      },
    ])

    sendMutation.mutate(messageToSend)
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full">
          <Bot className="text-primary-600 dark:text-primary-400" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Biveto Assistente</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Powered by IA - Análise personalizada das suas finanças
          </p>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-4">
        {/* Welcome Message */}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="mx-auto text-primary-500 dark:text-primary-400 mb-4" size={48} />
            <p className="text-gray-600 dark:text-gray-300 mb-6">{welcomeMessage}</p>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3 mb-6 max-w-md mx-auto">
              {QUICK_ACTIONS.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(action.query)}
                  className="flex items-center gap-2 p-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-300 dark:hover:border-primary-700 transition-colors text-left"
                >
                  <action.icon size={18} className="text-primary-500 dark:text-primary-400 flex-shrink-0" />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>

            {/* Suggestions */}
            {!loadingSuggestions && suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Ou pergunte sobre:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((suggestion: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-full text-sm text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {messages.map((message, index) => (
          <div
            key={index}
            className={clsx('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {message.role === 'assistant' && (
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-full h-fit">
                <Bot className="text-primary-600 dark:text-primary-400" size={20} />
              </div>
            )}

            <div
              className={clsx(
                'max-w-[80%] rounded-2xl px-4 py-3',
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600'
              )}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-headings:text-gray-900 dark:prose-headings:text-white">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{message.content}</p>
              )}

              {/* Data indicators */}
              {message.dataUsed && message.dataUsed.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-600">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Dados analisados: {message.dataUsed.join(', ')}
                  </p>
                </div>
              )}
            </div>

            {message.role === 'user' && (
              <div className="p-2 bg-gray-200 dark:bg-slate-600 rounded-full h-fit">
                <User className="text-gray-600 dark:text-gray-300" size={20} />
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {sendMutation.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-full h-fit">
              <Bot className="text-primary-600 dark:text-primary-400" size={20} />
            </div>
            <div className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="animate-spin" size={16} />
                <span className="text-sm">Analisando seus dados financeiros...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="mt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre seus gastos, metas, dívidas..."
            className="flex-1 input"
            disabled={sendMutation.isPending}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sendMutation.isPending}
            className="btn-primary px-4"
          >
            <Send size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
          Analiso suas transações, categorias, dívidas e metas para dar recomendações personalizadas.
        </p>
      </div>
    </div>
  )
}
