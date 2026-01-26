import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gamificationApi } from '../services/api'
import type { Badge } from '../components/gamification/BadgeCard'
import type { Challenge } from '../components/gamification/ChallengeCard'

// Types for API responses
interface StreakResponse {
  streak_type: string
  current_count: number
  longest_count: number
  last_action_date: string | null
  freeze_available: number
  is_active_today: boolean
  next_milestone: number | null
  days_until_next_milestone: number | null
}

interface StreakDayInfo {
  date: string
  day_name: string
  completed: boolean
  is_today: boolean
  is_future: boolean
}

interface StreakWeekView {
  days: StreakDayInfo[]
  current_streak: number
  streak_type: string
  next_milestone: number | null
  days_until_next_milestone: number | null
}

interface GamificationSummary {
  current_points: number
  lifetime_points: number
  badges_earned: number
  badges_total: number
  recent_badge: Badge | null
  main_streak: StreakResponse | null
  active_challenges: number
  completed_challenges_month: number
  unseen_badges: number
}

interface ChallengeListResponse {
  active: Challenge[]
  completed: Challenge[]
  failed: Challenge[]
  available: Challenge[]
}

interface PointsTransaction {
  id: number
  amount: number
  balance_after: number
  reason: string
  reference_type: string | null
  reference_id: string | null
  created_at: string
}

interface PointsHistoryResponse {
  transactions: PointsTransaction[]
  current_balance: number
  lifetime_total: number
}

export function useGamification() {
  const queryClient = useQueryClient()

  // Summary for dashboard
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery<GamificationSummary>({
    queryKey: ['gamification', 'summary'],
    queryFn: () => gamificationApi.getSummary().then((r) => r.data),
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  // Streak week view
  const {
    data: streakWeek,
    isLoading: streakLoading,
    error: streakError,
  } = useQuery<StreakWeekView>({
    queryKey: ['gamification', 'streak-week'],
    queryFn: () => gamificationApi.getStreakWeek().then((r) => r.data),
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  // Mark badges as seen
  const markSeenMutation = useMutation({
    mutationFn: () => gamificationApi.markBadgesSeen(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification'] })
    },
  })

  // Start challenge
  const startChallengeMutation = useMutation({
    mutationFn: (challengeId: number) => gamificationApi.startChallenge(challengeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification', 'challenges'] })
      queryClient.invalidateQueries({ queryKey: ['gamification', 'summary'] })
    },
  })

  // Invalidate all gamification queries
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['gamification'] })
  }

  return {
    // Summary data
    summary,
    summaryLoading,
    summaryError,

    // Streak data
    streakWeek,
    streakLoading,
    streakError,

    // Actions
    markSeen: markSeenMutation.mutate,
    markSeenLoading: markSeenMutation.isPending,
    startChallenge: startChallengeMutation.mutate,
    startChallengeLoading: startChallengeMutation.isPending,

    // Utility
    invalidateAll,
    isLoading: summaryLoading || streakLoading,
  }
}

// Separate hook for badges (may be filtered by category)
export function useBadges(category?: string) {
  return useQuery<Badge[]>({
    queryKey: ['gamification', 'badges', category],
    queryFn: () => gamificationApi.getBadges(category).then((r) => r.data),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Separate hook for challenges
export function useChallenges() {
  return useQuery<ChallengeListResponse>({
    queryKey: ['gamification', 'challenges'],
    queryFn: () => gamificationApi.getChallenges().then((r) => r.data),
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

// Separate hook for points history
export function usePointsHistory(limit = 20, offset = 0) {
  return useQuery<PointsHistoryResponse>({
    queryKey: ['gamification', 'points-history', limit, offset],
    queryFn: () => gamificationApi.getPointsHistory(limit, offset).then((r) => r.data),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
