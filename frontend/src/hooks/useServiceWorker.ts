import { useState, useEffect, useCallback } from 'react'

interface UseServiceWorkerReturn {
  hasUpdate: boolean
  isUpdating: boolean
  updateApp: () => void
  dismissUpdate: () => void
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [hasUpdate, setHasUpdate] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handleControllerChange = () => {
      // New service worker took control, reload to get fresh content
      window.location.reload()
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CACHE_UPDATED') {
        console.log('Cache updated to version:', event.data.version)
        // Optionally show a toast that data is fresh
      }
    }

    // Listen for controller changes
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener('message', handleMessage)

    // Check for updates on registration
    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (!registration) return

        // Check if there's already a waiting worker
        if (registration.waiting) {
          setWaitingWorker(registration.waiting)
          setHasUpdate(true)
        }

        // Listen for new updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              setWaitingWorker(newWorker)
              setHasUpdate(true)
            }
          })
        })

        // Check for updates periodically (every 5 minutes)
        const intervalId = setInterval(() => {
          registration.update().catch(console.warn)
        }, 5 * 60 * 1000)

        // Also check on focus
        const handleFocus = () => {
          registration.update().catch(console.warn)
        }
        window.addEventListener('focus', handleFocus)

        return () => {
          clearInterval(intervalId)
          window.removeEventListener('focus', handleFocus)
        }
      } catch (error) {
        console.warn('Error checking for SW updates:', error)
      }
    }

    checkForUpdates()

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [])

  const updateApp = useCallback(() => {
    if (!waitingWorker) return

    setIsUpdating(true)

    // Tell the waiting worker to skip waiting
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })

    // The controllerchange event will trigger a reload
  }, [waitingWorker])

  const dismissUpdate = useCallback(() => {
    setHasUpdate(false)
  }, [])

  return {
    hasUpdate,
    isUpdating,
    updateApp,
    dismissUpdate,
  }
}
