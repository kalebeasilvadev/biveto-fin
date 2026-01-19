import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { clsx } from 'clsx'
import HelpModal from './HelpModal'
import { getHelpContent } from '../../data/help-content'

interface HelpButtonProps {
  pageId: string
  className?: string
}

export default function HelpButton({ pageId, className }: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const content = getHelpContent(pageId)

  if (!content) return null

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={clsx(
          'p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700',
          className
        )}
        title="Ajuda"
        aria-label="Abrir ajuda"
      >
        <HelpCircle size={20} />
      </button>
      <HelpModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        content={content}
      />
    </>
  )
}
