import { create } from 'zustand'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAState {
  installPromptEvent: BeforeInstallPromptEvent | null
  isInstalled: boolean
  isDismissed: boolean
  hasEngagement: boolean
  setInstallPromptEvent: (event: BeforeInstallPromptEvent | null) => void
  setIsInstalled: (installed: boolean) => void
  setIsDismissed: (dismissed: boolean) => void
  setHasEngagement: (engaged: boolean) => void
  promptInstall: () => Promise<void>
  dismissBanner: () => void
}

const DISMISS_KEY = 'biveto-pwa-install-dismissed'
const DISMISS_DURATION = 14 * 24 * 60 * 60 * 1000 // 14 days

export const usePWAStore = create<PWAState>((set, get) => ({
  installPromptEvent: null,
  isInstalled: false,
  isDismissed: false,
  hasEngagement: false,

  setInstallPromptEvent: (event) => set({ installPromptEvent: event }),
  setIsInstalled: (installed) => set({ isInstalled: installed }),
  setIsDismissed: (dismissed) => set({ isDismissed: dismissed }),
  setHasEngagement: (engaged) => set({ hasEngagement: engaged }),

  promptInstall: async () => {
    const { installPromptEvent } = get()
    if (!installPromptEvent) {
      console.log('No install prompt event available')
      return
    }

    try {
      await installPromptEvent.prompt()
      const { outcome } = await installPromptEvent.userChoice

      if (outcome === 'accepted') {
        set({ isInstalled: true })
      }

      set({ installPromptEvent: null })
    } catch (error) {
      console.error('Error prompting install:', error)
    }
  },

  dismissBanner: () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    set({ isDismissed: true })
  },
}))

// Initialize PWA listeners (runs once when module loads)
if (typeof window !== 'undefined') {
  // Check if already installed
  const checkInstalled = () => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true
      || document.referrer.includes('android-app://')

    usePWAStore.getState().setIsInstalled(isStandalone)
  }

  checkInstalled()

  // Listen for display mode changes
  window.matchMedia('(display-mode: standalone)').addEventListener('change', checkInstalled)

  // Capture beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    console.log('beforeinstallprompt event captured')
    usePWAStore.getState().setInstallPromptEvent(event as BeforeInstallPromptEvent)
  })

  // Listen for successful install
  window.addEventListener('appinstalled', () => {
    console.log('App installed')
    usePWAStore.getState().setIsInstalled(true)
    usePWAStore.getState().setInstallPromptEvent(null)
  })

  // Check if dismissed recently
  const dismissedAt = localStorage.getItem(DISMISS_KEY)
  if (dismissedAt) {
    const dismissedTime = parseInt(dismissedAt, 10)
    if (Date.now() - dismissedTime < DISMISS_DURATION) {
      usePWAStore.getState().setIsDismissed(true)
    } else {
      localStorage.removeItem(DISMISS_KEY)
    }
  }
}
