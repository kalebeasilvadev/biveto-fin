import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { chatApi } from '../services/api'
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  TrendingUp,
  PiggyBank,
  CreditCard,
  Target,
  History,
  Plus,
  Trash2,
  MessageSquare,
} from 'lucide-react'
import { clsx } from 'clsx'
import ReactMarkdown from 'react-markdown'
import { HelpButton } from '../components/help'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  dataUsed?: string[]
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  lastUpdated: Date
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

// Local storage key for conversations
const CONVERSATIONS_KEY = 'biveto_chat_history'

function loadConversations(): Conversation[] {
  try {
    const stored = localStorage.getItem(CONVERSATIONS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed.map((c: Conversation) => ({
        ...c,
        lastUpdated: new Date(c.lastUpdated),
        messages: c.messages.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      }))
    }
  } catch {
    // Ignore errors
  }
  return []
}

function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
  } catch {
    // Ignore errors
  }
}

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations)
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false) // Hidden by default on mobile
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

      const newMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        dataUsed: data.data_used,
      }

      setMessages((prev) => {
        const updated = [...prev, newMessage]
        saveCurrentConversation(updated, data.conversation_id)
        return updated
      })
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

  const saveCurrentConversation = (msgs: Message[], convId: string) => {
    const title = msgs[0]?.content.slice(0, 50) || 'Nova conversa'
    const conversation: Conversation = {
      id: convId,
      title: title + (title.length >= 50 ? '...' : ''),
      messages: msgs,
      lastUpdated: new Date(),
    }

    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== convId)
      const updated = [conversation, ...filtered].slice(0, 50) // Keep last 50 conversations
      saveConversations(updated)
      return updated
    })
    setCurrentConversation(conversation)
  }

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

    const userMessage: Message = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
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

  const startNewConversation = () => {
    setMessages([])
    setConversationId(null)
    setCurrentConversation(null)
  }

  const loadConversation = (conversation: Conversation) => {
    setMessages(conversation.messages)
    setConversationId(conversation.id)
    setCurrentConversation(conversation)
  }

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      saveConversations(updated)
      return updated
    })
    if (currentConversation?.id === id) {
      startNewConversation()
    }
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Hoje'
    if (days === 1) return 'Ontem'
    if (days < 7) return `${days} dias atrás`
    return date.toLocaleDateString('pt-BR')
  }

  return (
    <div className="chat-container flex z-10 bg-white dark:bg-slate-800 overflow-hidden">
      {/* Sidebar overlay for mobile */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar with conversation history */}
      <div
        className={clsx(
          'w-72 lg:w-80 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex-shrink-0 flex flex-col transition-transform duration-300 z-50',
          'fixed inset-y-0 left-0',
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors"
          >
            <Plus size={20} />
            Nova conversa
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <MessageSquare className="mx-auto mb-3" size={32} />
              <p className="text-sm">Nenhuma conversa ainda</p>
              <p className="text-xs mt-1">Comece uma nova conversa!</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv)}
                className={clsx(
                  'p-3 rounded-xl cursor-pointer transition-all duration-200 group',
                  currentConversation?.id === conv.id
                    ? 'bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800'
                    : 'bg-white dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 border border-transparent'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {conv.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {conv.messages.length} mensagens
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(conv.lastUpdated)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    title="Excluir conversa"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 lg:px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Histórico de conversas"
          >
            <History size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="p-2.5 bg-primary-100 dark:bg-primary-900/30 rounded-full">
            <Bot className="text-primary-600 dark:text-primary-400" size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Biveto Assistente</h1>
              <HelpButton pageId="chat" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Powered by IA - Análise personalizada das suas finanças
            </p>
          </div>
          {currentConversation && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium rounded-full">
              {currentConversation.messages.length} mensagens
            </span>
          )}
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900/50 p-4 lg:p-6 space-y-4">
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="text-center py-8 max-w-lg mx-auto">
              <Sparkles className="mx-auto text-primary-500 dark:text-primary-400 mb-4" size={48} />
              <p className="text-gray-600 dark:text-gray-300 mb-6">{welcomeMessage}</p>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {QUICK_ACTIONS.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(action.query)}
                    className="flex items-center gap-2 p-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-sm text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-300 dark:hover:border-primary-700 transition-colors text-left"
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
                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-full h-fit flex-shrink-0">
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
              </div>

              {message.role === 'user' && (
                <div className="p-2 bg-gray-200 dark:bg-slate-600 rounded-full h-fit flex-shrink-0">
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
        <div className="p-4 lg:p-6 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex gap-3 max-w-4xl mx-auto">
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
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
            Analiso suas transações, categorias, dívidas e metas para dar recomendações personalizadas.
          </p>
        </div>
      </div>
    </div>
  )
}
