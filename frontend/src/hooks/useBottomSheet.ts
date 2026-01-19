import { useState, useCallback, useRef, useEffect } from 'react'

interface UseBottomSheetOptions {
  snapPoints?: number[]  // Percentages: [0.5, 0.9] = 50% and 90% of screen height
  defaultSnapPoint?: number
  onClose?: () => void
}

interface UseBottomSheetReturn {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  currentSnapPoint: number
  setSnapPoint: (index: number) => void
  dragHandlers: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: () => void
  }
  translateY: number
  isDragging: boolean
}

export function useBottomSheet(options: UseBottomSheetOptions = {}): UseBottomSheetReturn {
  const {
    snapPoints = [0.5, 0.9],
    defaultSnapPoint = 0,
    onClose
  } = options

  const [isOpen, setIsOpen] = useState(false)
  const [currentSnapPoint, setCurrentSnapPoint] = useState(defaultSnapPoint)
  const [translateY, setTranslateY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const dragStartY = useRef(0)
  const dragStartTranslate = useRef(0)
  const sheetHeight = useRef(0)

  // Reset state when opening
  const open = useCallback(() => {
    setIsOpen(true)
    setCurrentSnapPoint(defaultSnapPoint)
    setTranslateY(0)
  }, [defaultSnapPoint])

  const close = useCallback(() => {
    setIsOpen(false)
    setTranslateY(0)
    onClose?.()
  }, [onClose])

  const toggle = useCallback(() => {
    if (isOpen) {
      close()
    } else {
      open()
    }
  }, [isOpen, open, close])

  const setSnapPoint = useCallback((index: number) => {
    if (index >= 0 && index < snapPoints.length) {
      setCurrentSnapPoint(index)
    }
  }, [snapPoints.length])

  // Calculate sheet height based on current snap point
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sheetHeight.current = window.innerHeight * snapPoints[currentSnapPoint]
    }
  }, [currentSnapPoint, snapPoints])

  // Handle keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        close()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, close])

  // Drag handlers for swipe gestures
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true)
    dragStartY.current = e.touches[0].clientY
    dragStartTranslate.current = translateY
  }, [translateY])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return

    const currentY = e.touches[0].clientY
    const deltaY = currentY - dragStartY.current

    // Only allow dragging down (positive deltaY) or up to a limit
    const newTranslateY = Math.max(-50, dragStartTranslate.current + deltaY)
    setTranslateY(newTranslateY)
  }, [isDragging])

  const onTouchEnd = useCallback(() => {
    setIsDragging(false)

    // If dragged down more than 100px, close the sheet
    if (translateY > 100) {
      close()
    } else if (translateY < -30) {
      // If dragged up, snap to higher point if available
      if (currentSnapPoint < snapPoints.length - 1) {
        setCurrentSnapPoint(currentSnapPoint + 1)
      }
      setTranslateY(0)
    } else {
      // Snap back
      setTranslateY(0)
    }
  }, [translateY, close, currentSnapPoint, snapPoints.length])

  return {
    isOpen,
    open,
    close,
    toggle,
    currentSnapPoint,
    setSnapPoint,
    dragHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    translateY,
    isDragging,
  }
}
