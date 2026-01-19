import { useEffect, useRef, ReactNode } from 'react'
import { clsx } from 'clsx'
import { createPortal } from 'react-dom'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  snapPoints?: number[]  // Height percentages: [0.5, 0.9] = 50%, 90%
  currentSnapPoint?: number
  dragHandlers?: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: () => void
  }
  translateY?: number
  isDragging?: boolean
  className?: string
}

export default function BottomSheet({
  isOpen,
  onClose,
  children,
  snapPoints = [0.6, 0.9],
  currentSnapPoint = 0,
  dragHandlers,
  translateY = 0,
  isDragging = false,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const firstFocusableRef = useRef<HTMLButtonElement>(null)

  // Calculate height based on snap point
  const heightPercent = snapPoints[currentSnapPoint] * 100

  // Focus trap - focus first element when opened
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      setTimeout(() => {
        firstFocusableRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // Prevent scroll on body when open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const content = (
    <>
      {/* Backdrop overlay */}
      <div
        className={clsx(
          'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={clsx(
          'fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl',
          isDragging ? '' : 'transition-transform duration-300 ease-out',
          className
        )}
        style={{
          height: `${heightPercent}vh`,
          maxHeight: 'calc(100vh - 60px)',
          transform: `translateY(${isOpen ? translateY : '100%'}px)`,
        }}
      >
        {/* Handle bar - draggable area */}
        <div
          className="flex-shrink-0 py-3 cursor-grab active:cursor-grabbing"
          {...dragHandlers}
        >
          <div className="w-10 h-1 mx-auto bg-gray-300 dark:bg-slate-600 rounded-full" />
        </div>

        {/* Close button (visually hidden but accessible) */}
        <button
          ref={firstFocusableRef}
          onClick={onClose}
          className="sr-only"
          aria-label="Fechar menu"
        >
          Fechar
        </button>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-safe">
          {children}
        </div>
      </div>
    </>
  )

  // Portal to body for proper z-index stacking
  return createPortal(content, document.body)
}
