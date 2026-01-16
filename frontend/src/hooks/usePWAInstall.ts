import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAInstallState {
  isInstallable: boolean
  isInstalled: boolean
  isIOS: boolean
  promptInstall: () => Promise<void>
  dismiss: () => void
}

const DISMISS_KEY = 'biveto-pwa-install-dismissed'
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

export function usePWAInstall(): PWAInstallState {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  // Check if running on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream

  // Check if app is already installed (standalone mode)
  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (navigator as unknown as { standalone?: boolean }).standalone === true
        || document.referrer.includes('android-app://')

      setIsInstalled(isStandalone)
    }

    checkInstalled()

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    mediaQuery.addEventListener('change', checkInstalled)

    return () => mediaQuery.removeEventListener('change', checkInstalled)
  }, [])

  // Check if user dismissed the prompt recently
  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10)
      if (Date.now() - dismissedTime < DISMISS_DURATION) {
        setIsDismissed(true)
      } else {
        localStorage.removeItem(DISMISS_KEY)
      }
    }
  }, [])

  // Capture the beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      // Prevent the mini-infobar from appearing
      event.preventDefault()
      setInstallPromptEvent(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setInstallPromptEvent(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!installPromptEvent) return

    try {
      await installPromptEvent.prompt()
      const { outcome } = await installPromptEvent.userChoice

      if (outcome === 'accepted') {
        setIsInstalled(true)
      }

      // Clear the saved prompt regardless of outcome
      setInstallPromptEvent(null)
    } catch (error) {
      console.error('Error prompting install:', error)
    }
  }, [installPromptEvent])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setIsDismissed(true)
  }, [])

  // For iOS, show instructions if not installed and not dismissed
  const isInstallable = !isInstalled && !isDismissed && (!!installPromptEvent || isIOS)

  return {
    isInstallable,
    isInstalled,
    isIOS,
    promptInstall,
    dismiss,
  }
}
