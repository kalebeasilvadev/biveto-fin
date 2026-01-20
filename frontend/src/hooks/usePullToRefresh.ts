import { useState, useEffect, useCallback, useRef } from 'react'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void
  threshold?: number // pixels to pull before triggering
  maxPull?: number // maximum pull distance
  disabled?: boolean
  minStartDistance?: number // minimum distance to consider as intentional pull
  scrollTolerance?: number // tolerance for scrollTop check
}

interface UsePullToRefreshReturn {
  pullDistance: number
  isRefreshing: boolean
  isPulling: boolean
  containerRef: React.RefObject<HTMLDivElement>
}

export function usePullToRefresh({
  onRefresh,
  threshold = 100,
  maxPull = 150,
  disabled = false,
  minStartDistance = 15,
  scrollTolerance = 5,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const startY = useRef(0)
  const currentY = useRef(0)
  const lastRefreshTime = useRef(0)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return

    // Debounce: prevent reactivation within 300ms of last refresh
    if (Date.now() - lastRefreshTime.current < 300) return

    const container = containerRef.current
    if (!container) return

    // Only start pull if at top of scroll (with tolerance)
    if (container.scrollTop > scrollTolerance) return

    startY.current = e.touches[0].clientY
    setIsPulling(true)
  }, [disabled, isRefreshing, scrollTolerance])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return

    const container = containerRef.current
    if (!container) return

    // Check if we're at the top (with tolerance)
    if (container.scrollTop > scrollTolerance) {
      setPullDistance(0)
      return
    }

    currentY.current = e.touches[0].clientY
    const diff = currentY.current - startY.current

    // Only consider as pull after minStartDistance to filter accidental touches
    if (diff > minStartDistance) {
      // Apply resistance - pull gets harder as you go
      const resistance = 0.5
      const adjustedDiff = diff - minStartDistance
      const distance = Math.min(adjustedDiff * resistance, maxPull)
      setPullDistance(distance)

      // Prevent default scroll only when there's clear pull intention
      if (distance > 25) {
        e.preventDefault()
      }
    }
  }, [isPulling, disabled, isRefreshing, maxPull, minStartDistance, scrollTolerance])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) return

    setIsPulling(false)

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(threshold) // Keep at threshold during refresh
      lastRefreshTime.current = Date.now() // Mark time for debounce

      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh, disabled])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Add touch listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    pullDistance,
    isRefreshing,
    isPulling,
    containerRef,
  }
}
