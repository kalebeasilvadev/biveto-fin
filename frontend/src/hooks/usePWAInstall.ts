import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAInstallState {
  // Can the app be installed? (event available or iOS)
  canInstall: boolean
  // Should show the banner? (canInstall + engagement criteria met)
  shouldShowBanner: boolean
  isInstalled: boolean
  isIOS: boolean
  promptInstall: () => Promise<void>
  dismissBanner: () => void
}

const DISMISS_KEY = 'biveto-pwa-install-dismissed'
const VISIT_COUNT_KEY = 'biveto-visit-count'
const FIRST_VISIT_KEY = 'biveto-first-visit'
const DISMISS_DURATION = 14 * 24 * 60 * 60 * 1000 // 14 days after dismiss
const MIN_VISITS_FOR_BANNER = 2 // Show banner after 2nd visit
const MIN_TIME_ON_SITE = 60 * 1000 // Or after 60 seconds on first visit

export function usePWAInstall(): PWAInstallState {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [hasEngagement, setHasEngagement] = useState(false)

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

    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    mediaQuery.addEventListener('change', checkInstalled)

    return () => mediaQuery.removeEventListener('change', checkInstalled)
  }, [])

  // Track visits and check engagement criteria
  useEffect(() => {
    // Increment visit count
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1
    localStorage.setItem(VISIT_COUNT_KEY, visitCount.toString())

    // Track first visit time
    let firstVisit = localStorage.getItem(FIRST_VISIT_KEY)
    if (!firstVisit) {
      firstVisit = Date.now().toString()
      localStorage.setItem(FIRST_VISIT_KEY, firstVisit)
    }

    // Check if user meets engagement criteria
    const meetsVisitCriteria = visitCount >= MIN_VISITS_FOR_BANNER

    if (meetsVisitCriteria) {
      setHasEngagement(true)
    } else {
      // If not enough visits, wait for time on site
      const timer = setTimeout(() => {
        setHasEngagement(true)
      }, MIN_TIME_ON_SITE)

      return () => clearTimeout(timer)
    }
  }, [])

  // Check if user dismissed the banner recently
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
      event.preventDefault()
      setInstallPromptEvent(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

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

      setInstallPromptEvent(null)
    } catch (error) {
      console.error('Error prompting install:', error)
    }
  }, [installPromptEvent])

  const dismissBanner = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setIsDismissed(true)
  }, [])

  // Can install: event available OR iOS (for instructions)
  const canInstall = !isInstalled && (!!installPromptEvent || isIOS)

  // Should show banner: can install + not dismissed + has engagement
  const shouldShowBanner = canInstall && !isDismissed && hasEngagement

  return {
    canInstall,
    shouldShowBanner,
    isInstalled,
    isIOS,
    promptInstall,
    dismissBanner,
  }
}
