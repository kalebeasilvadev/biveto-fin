import { useState, useEffect } from 'react'
import { Lightbulb, X, ChevronRight, ChevronLeft } from 'lucide-react'
import { getTipsForContext, FinancialTip } from '../../data/financialTips'

interface ContextualTipProps {
  context: string
  className?: string
  variant?: 'banner' | 'card' | 'compact'
  showMultiple?: boolean
  maxTips?: number
}

// Store dismissed tips in localStorage
const DISMISSED_TIPS_KEY = 'biveto_dismissed_tips'

function getDismissedTips(): string[] {
  try {
    const stored = localStorage.getItem(DISMISSED_TIPS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function dismissTip(tipId: string): void {
  const dismissed = getDismissedTips()
  if (!dismissed.includes(tipId)) {
    dismissed.push(tipId)
    localStorage.setItem(DISMISSED_TIPS_KEY, JSON.stringify(dismissed))
  }
}

function isTipDismissed(tipId: string): boolean {
  return getDismissedTips().includes(tipId)
}

export default function ContextualTip({
  context,
  className = '',
  variant = 'banner',
  showMultiple = false,
  maxTips = 3,
}: ContextualTipProps) {
  const [tips, setTips] = useState<FinancialTip[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const allTips = getTipsForContext(context, maxTips)
    const visibleTips = allTips.filter(tip => !isTipDismissed(tip.id))
    setTips(visibleTips)
    setCurrentIndex(0)
    setIsVisible(visibleTips.length > 0)
  }, [context, maxTips])

  const handleDismiss = (tipId: string) => {
    dismissTip(tipId)
    const remainingTips = tips.filter(t => t.id !== tipId)
    setTips(remainingTips)
    if (remainingTips.length === 0) {
      setIsVisible(false)
    } else if (currentIndex >= remainingTips.length) {
      setCurrentIndex(remainingTips.length - 1)
    }
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % tips.length)
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + tips.length) % tips.length)
  }

  if (!isVisible || tips.length === 0) {
    return null
  }

  const currentTip = tips[currentIndex]

  if (variant === 'compact') {
    return (
      <div className={`flex items-start gap-2 text-sm ${className}`}>
        <Lightbulb size={16} className="text-yellow-500 flex-shrink-0 mt-0.5" />
        <p className="text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-white">{currentTip.title}:</span>{' '}
          {currentTip.content}
        </p>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className={`bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-800/30 rounded-lg">
            <Lightbulb size={18} className="text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                {currentTip.title}
              </h4>
              <button
                onClick={() => handleDismiss(currentTip.id)}
                className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-800/50 rounded-lg transition-colors"
                title="Não mostrar novamente"
              >
                <X size={14} className="text-yellow-600 dark:text-yellow-400" />
              </button>
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              {currentTip.content}
            </p>
            {tips.length > 1 && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handlePrev}
                  className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-800/50 rounded-lg transition-colors"
                >
                  <ChevronLeft size={16} className="text-yellow-600 dark:text-yellow-400" />
                </button>
                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                  {currentIndex + 1} / {tips.length}
                </span>
                <button
                  onClick={handleNext}
                  className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-800/50 rounded-lg transition-colors"
                >
                  <ChevronRight size={16} className="text-yellow-600 dark:text-yellow-400" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Default: banner variant
  return (
    <div
      className={`bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 ${className}`}
    >
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex p-2 bg-yellow-100 dark:bg-yellow-800/30 rounded-xl">
          <Lightbulb size={24} className="text-yellow-600 dark:text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
            <Lightbulb size={16} className="sm:hidden text-yellow-600" />
            {currentTip.title}
          </h4>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            {currentTip.content}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tips.length > 1 && (
            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-800/50 rounded-lg transition-colors"
              >
                <ChevronLeft size={18} className="text-yellow-600 dark:text-yellow-400" />
              </button>
              <span className="text-xs text-yellow-600 dark:text-yellow-400 min-w-[3rem] text-center">
                {currentIndex + 1} / {tips.length}
              </span>
              <button
                onClick={handleNext}
                className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-800/50 rounded-lg transition-colors"
              >
                <ChevronRight size={18} className="text-yellow-600 dark:text-yellow-400" />
              </button>
            </div>
          )}
          <button
            onClick={() => handleDismiss(currentTip.id)}
            className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-800/50 rounded-lg transition-colors"
            title="Não mostrar novamente"
          >
            <X size={18} className="text-yellow-600 dark:text-yellow-400" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Export a hook for programmatic tip access
export function useContextualTip(context: string) {
  const [tip, setTip] = useState<FinancialTip | null>(null)

  useEffect(() => {
    const tips = getTipsForContext(context, 1)
    const visibleTip = tips.find(t => !isTipDismissed(t.id))
    setTip(visibleTip || null)
  }, [context])

  const dismiss = () => {
    if (tip) {
      dismissTip(tip.id)
      setTip(null)
    }
  }

  return { tip, dismiss }
}
