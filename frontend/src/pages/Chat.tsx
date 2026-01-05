import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { chatApi } from '../services/api'
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatResponse {
  message: string
  conversation_id: string
  suggestions: string[]
  data_used: string[]
}

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

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return

    const userMessage = input.trim()
    setInput('')

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      },
    ])

    sendMutation.mutate(userMessage)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
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
        <div className="p-3 bg-primary-100 rounded-full">
          <Bot className="text-primary-600" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fin - Assistente Financeiro</h1>
          <p className="text-sm text-gray-500">
            Powered by IA - Análise personalizada das suas finanças
          </p>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 space-y-4">
        {/* Welcome Message */}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="mx-auto text-primary-500 mb-4" size={48} />
            <p className="text-gray-600 mb-6">{welcomeMessage}</p>

            {/* Suggestions */}
            {!loadingSuggestions && suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-3">Sugestões para começar:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((suggestion: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-primary-50 hover:border-primary-300 transition-colors"
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
              <div className="p-2 bg-primary-100 rounded-full h-fit">
                <Bot className="text-primary-600" size={20} />
              </div>
            )}

            <div
              className={clsx(
                'max-w-[80%] rounded-2xl px-4 py-3',
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200'
              )}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{message.content}</p>
              )}
            </div>

            {message.role === 'user' && (
              <div className="p-2 bg-gray-200 rounded-full h-fit">
                <User className="text-gray-600" size={20} />
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {sendMutation.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="p-2 bg-primary-100 rounded-full h-fit">
              <Bot className="text-primary-600" size={20} />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={16} />
                <span className="text-sm">Analisando seus dados...</span>
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
            placeholder="Digite sua pergunta sobre suas finanças..."
            className="flex-1 input"
            disabled={sendMutation.isPending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="btn-primary px-4"
          >
            <Send size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          O Fin analisa suas transações, dívidas, metas e orçamentos para dar recomendações personalizadas.
        </p>
      </div>
    </div>
  )
}
