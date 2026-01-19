import { useState } from 'react'
import { X, ChevronDown, ChevronRight, Lightbulb, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'
import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'
import type { HelpContent } from '../../data/help-content/types'

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
  content: HelpContent
}

export default function HelpModal({ isOpen, onClose, content }: HelpModalProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]))

  if (!isOpen) return null

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedSections(newExpanded)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg max-h-[85vh] shadow-xl animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {content.pageTitle}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {content.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Sections */}
          {content.sections.map((section, index) => (
            <div
              key={index}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleSection(index)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  {section.title}
                </span>
                {expandedSections.has(index) ? (
                  <ChevronDown size={18} className="text-gray-400" />
                ) : (
                  <ChevronRight size={18} className="text-gray-400" />
                )}
              </button>
              {expandedSections.has(index) && (
                <div className="px-3 pb-3 text-sm text-gray-600 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>,
                      em: ({ children }) => <em className="text-primary-600 dark:text-primary-400 not-italic">{children}</em>,
                    }}
                  >
                    {section.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ))}

          {/* Tips */}
          {content.tips && content.tips.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={16} className="text-amber-600 dark:text-amber-400" />
                <span className="font-medium text-amber-800 dark:text-amber-300 text-sm">
                  Dicas
                </span>
              </div>
              <ul className="space-y-1">
                {content.tips.map((tip, index) => (
                  <li
                    key={index}
                    className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2"
                  >
                    <span className="text-amber-500">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Related Pages */}
          {content.relatedPages && content.relatedPages.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Páginas relacionadas
              </p>
              <div className="flex flex-wrap gap-2">
                {content.relatedPages.map((page, index) => (
                  <Link
                    key={index}
                    to={page.path}
                    onClick={onClose}
                    className={clsx(
                      'inline-flex items-center gap-1 px-3 py-1.5 text-sm',
                      'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                      'rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/30',
                      'hover:text-primary-700 dark:hover:text-primary-400 transition-colors'
                    )}
                  >
                    {page.title}
                    <ArrowRight size={14} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full btn-primary"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
