import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { chatApi } from '../services/api'
import {
  Bot,
  X,
  Send,
  Loader2,
  Sparkles,
  TrendingUp,
  PiggyBank,
  CreditCard,
  Target,
  Minimize2,
  Maximize2,
  History,
} from 'lucide-react'
import { clsx } from 'clsx'
import ReactMarkdown from 'react-markdown'
import { useLocation } from 'react-router-dom'

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
  { icon: TrendingUp, label: 'Gastos', query: 'Quanto gastei esse mês?' },
  { icon: PiggyBank, label: 'Economias', query: 'Como economizar mais?' },
  { icon: CreditCard, label: 'Maiores gastos', query: 'Meus maiores gastos?' },
  { icon: Target, label: 'Metas', query: 'Como estão minhas metas?' },
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

export default function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations)
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // Check if we're on chat page (for conditional rendering later)
  const isOnChatPage = location.pathname === '/chat'

  const { data: suggestionsData } = useQuery({
    queryKey: ['chat-suggestions'],
    queryFn: () => chatApi.getSuggestions(),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  })

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
        // Save to conversation
        saveCurrentConversation(updated, data.conversation_id)
        return updated
      })
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro. Tente novamente.',
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
      const updated = [conversation, ...filtered].slice(0, 20) // Keep last 20 conversations
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
    setShowHistory(false)
  }

  const loadConversation = (conversation: Conversation) => {
    setMessages(conversation.messages)
    setConversationId(conversation.id)
    setCurrentConversation(conversation)
    setShowHistory(false)
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

  // Don't show on chat page
  if (isOnChatPage) {
    return null
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={clsx(
          'fixed z-50 w-14 h-14 rounded-full gradient-biveto shadow-lg shadow-primary-500/30 flex items-center justify-center text-white transition-all duration-300 hover:scale-105 active:scale-95',
          'bottom-24 right-4 lg:bottom-6 lg:right-6',
          isOpen && 'scale-0 opacity-0'
        )}
        aria-label="Abrir assistente"
      >
        <Bot size={26} />
      </button>

      {/* Chat Panel */}
      <div
        className={clsx(
          'fixed z-50 bg-white dark:bg-slate-800 shadow-2xl transition-all duration-300 flex flex-col',
          isExpanded
            ? 'inset-4 lg:inset-8 rounded-2xl'
            : 'bottom-24 right-4 lg:bottom-6 lg:right-6 w-[calc(100%-2rem)] max-w-md h-[70vh] max-h-[600px] rounded-2xl',
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-primary-500 to-primary-600 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <Bot className="text-white" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Biveto Assistente</h3>
              <p className="text-xs text-white/70">IA Financeira</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                showHistory ? 'bg-white/30 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
              title="Histórico"
            >
              <History size={18} />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-white/70 hover:bg-white/10 hover:text-white rounded-lg transition-colors hidden lg:block"
              title={isExpanded ? 'Minimizar' : 'Expandir'}
            >
              {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={() => {
                setIsOpen(false)
                setIsExpanded(false)
              }}
              className="p-2 text-white/70 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* History Panel */}
        {showHistory ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Histórico de conversas</h4>
              <button
                onClick={startNewConversation}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Nova conversa
              </button>
            </div>

            {conversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <History className="mx-auto mb-2" size={32} />
                <p>Nenhuma conversa ainda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => loadConversation(conv)}
                    className={clsx(
                      'p-3 rounded-lg cursor-pointer transition-colors group',
                      currentConversation?.id === conv.id
                        ? 'bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800'
                        : 'bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {conv.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {conv.messages.length} mensagens • {new Date(conv.lastUpdated).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Excluir"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Welcome Message */}
              {messages.length === 0 && (
                <div className="text-center py-4">
                  <Sparkles className="mx-auto text-primary-500 dark:text-primary-400 mb-3" size={36} />
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{welcomeMessage}</p>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ACTIONS.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleSend(action.query)}
                        className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-300 dark:hover:border-primary-700 transition-colors text-left"
                      >
                        <action.icon size={16} className="text-primary-500 dark:text-primary-400 flex-shrink-0" />
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={clsx('flex gap-2', message.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {message.role === 'assistant' && (
                    <div className="p-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-full h-fit flex-shrink-0">
                      <Bot className="text-primary-600 dark:text-primary-400" size={16} />
                    </div>
                  )}

                  <div
                    className={clsx(
                      'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                      message.role === 'user'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white'
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {sendMutation.isPending && (
                <div className="flex gap-2 justify-start">
                  <div className="p-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-full h-fit">
                    <Bot className="text-primary-600 dark:text-primary-400" size={16} />
                  </div>
                  <div className="bg-gray-100 dark:bg-slate-700 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Loader2 className="animate-spin" size={14} />
                      <span className="text-xs">Analisando...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-gray-200 dark:border-slate-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte algo..."
                  className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-slate-700 border-0 rounded-lg focus:ring-2 focus:ring-primary-500 dark:text-white"
                  disabled={sendMutation.isPending}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || sendMutation.isPending}
                  className="p-2 bg-primary-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Overlay when chat is open on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => {
            setIsOpen(false)
            setIsExpanded(false)
          }}
        />
      )}
    </>
  )
}
