import { useEffect } from 'react'
import { usePWAStore } from '../stores/pwaStore'

const VISIT_COUNT_KEY = 'biveto-visit-count'
const FIRST_VISIT_KEY = 'biveto-first-visit'
const MIN_VISITS_FOR_BANNER = 2 // Show banner after 2nd visit
const MIN_TIME_ON_SITE = 60 * 1000 // Or after 60 seconds on first visit

// Detect iOS
const getIsIOS = () => {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
}

// Detect Safari (works on iOS and macOS)
const getIsSafari = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // Safari but not Chrome/Firefox/Edge (which include "Safari" in their UA)
  return /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

export function usePWAInstall() {
  const {
    installPromptEvent,
    isInstalled,
    isDismissed,
    hasEngagement,
    setHasEngagement,
    promptInstall,
    dismissBanner,
  } = usePWAStore()

  const isIOS = getIsIOS()
  const isSafari = getIsSafari()

  // Track visits and check engagement criteria
  useEffect(() => {
    // Only run once per session
    const sessionKey = 'biveto-session-tracked'
    if (sessionStorage.getItem(sessionKey)) {
      // Already tracked this session, just check criteria
      const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10)
      if (visitCount >= MIN_VISITS_FOR_BANNER) {
        setHasEngagement(true)
      }
      return
    }
    sessionStorage.setItem(sessionKey, 'true')

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
    if (visitCount >= MIN_VISITS_FOR_BANNER) {
      setHasEngagement(true)
    } else {
      // If not enough visits, wait for time on site
      const timer = setTimeout(() => {
        setHasEngagement(true)
      }, MIN_TIME_ON_SITE)

      return () => clearTimeout(timer)
    }
  }, [setHasEngagement])

  // Can install logic:
  // - Android/Chrome: needs beforeinstallprompt event
  // - iOS Safari: always possible (manual process)
  // - iOS Chrome: NOT possible (show message to use Safari)
  const canInstallAndroid = !isIOS && !!installPromptEvent
  const canInstallIOS = isIOS // Always show on iOS (with different UI based on browser)
  const canInstall = !isInstalled && (canInstallAndroid || canInstallIOS)

  // Should show banner: can install + not dismissed + has engagement
  const shouldShowBanner = canInstall && !isDismissed && hasEngagement

  return {
    canInstall,
    shouldShowBanner,
    isInstalled,
    isIOS,
    isSafari,
    promptInstall,
    dismissBanner,
  }
}
