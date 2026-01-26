import { create } from 'zustand'
import type { Badge } from '../components/gamification/BadgeCard'

interface GamificationState {
  // Toast for achievement notification
  pendingBadge: Badge | null
  showBadgeToast: (badge: Badge) => void
  hideBadgeToast: () => void

  // Queue of badges to show
  badgeQueue: Badge[]
  enqueueBadge: (badge: Badge) => void
  dequeueBadge: () => Badge | undefined

  // Local cache of last known summary
  lastSummary: {
    current_points: number
    badges_earned: number
    main_streak_count: number
  } | null
  setLastSummary: (summary: {
    current_points: number
    badges_earned: number
    main_streak_count: number
  }) => void
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
  // Toast state
  pendingBadge: null,
  showBadgeToast: (badge) => set({ pendingBadge: badge }),
  hideBadgeToast: () => set({ pendingBadge: null }),

  // Badge queue for multiple achievements
  badgeQueue: [],
  enqueueBadge: (badge) =>
    set((state) => ({
      badgeQueue: [...state.badgeQueue, badge],
    })),
  dequeueBadge: () => {
    const queue = get().badgeQueue
    if (queue.length === 0) return undefined
    const [first, ...rest] = queue
    set({ badgeQueue: rest })
    return first
  },

  // Summary cache
  lastSummary: null,
  setLastSummary: (summary) => set({ lastSummary: summary }),
}))

// Helper to process gamification events from transaction responses
export function processGamificationEvent(event: {
  badges_earned?: Badge[]
  points_earned?: number
  new_total_points?: number
}) {
  const store = useGamificationStore.getState()

  // Queue any new badges for display
  if (event.badges_earned && event.badges_earned.length > 0) {
    for (const badge of event.badges_earned) {
      store.enqueueBadge(badge)
    }

    // Show the first badge immediately
    const firstBadge = store.dequeueBadge()
    if (firstBadge) {
      store.showBadgeToast(firstBadge)
    }
  }
}
