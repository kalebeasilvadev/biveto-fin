import { Lock } from 'lucide-react'
import * as Icons from 'lucide-react'
import { LucideIcon } from 'lucide-react'

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  category: string
  points_reward: number
  is_earned: boolean
  earned_at?: string
  seen_at?: string | null
  progress?: number
}

interface BadgeCardProps {
  badge: Badge
  onClick?: () => void
  compact?: boolean
}

const rarityStyles: Record<string, string> = {
  common: 'bg-gray-100 border-gray-300 dark:bg-slate-800 dark:border-slate-600',
  uncommon: 'bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-600',
  rare: 'bg-blue-50 border-blue-400 dark:bg-blue-900/20 dark:border-blue-600',
  epic: 'bg-purple-50 border-purple-400 dark:bg-purple-900/20 dark:border-purple-600',
  legendary: 'bg-yellow-50 border-yellow-400 shadow-lg shadow-yellow-400/20 dark:bg-yellow-900/20 dark:border-yellow-500',
}

const rarityIconColors: Record<string, string> = {
  common: 'text-gray-500',
  uncommon: 'text-green-500',
  rare: 'text-blue-500',
  epic: 'text-purple-500',
  legendary: 'text-yellow-500',
}

const rarityStars: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
}

export function BadgeCard({ badge, onClick, compact = false }: BadgeCardProps) {
  // Get icon dynamically from Lucide
  const IconComponent = ((Icons as unknown) as Record<string, LucideIcon>)[badge.icon] || Icons.Award

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`
          relative p-3 rounded-xl border-2 cursor-pointer
          transition-all duration-200 hover:scale-105
          ${rarityStyles[badge.rarity]}
          ${!badge.is_earned && 'opacity-60 grayscale'}
        `}
      >
        <div className="flex items-center gap-3">
          {badge.is_earned ? (
            <IconComponent size={24} className={rarityIconColors[badge.rarity]} />
          ) : (
            <Lock size={24} className="text-gray-400" />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
              {badge.is_earned ? badge.name : '???'}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {badge.is_earned ? badge.description : 'Badge bloqueado'}
            </p>
          </div>
        </div>

        {/* New badge indicator */}
        {badge.is_earned && !badge.seen_at && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
            !
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={`
        relative p-4 rounded-xl border-2 cursor-pointer
        transition-all duration-200 hover:scale-105
        ${rarityStyles[badge.rarity]}
        ${!badge.is_earned && 'opacity-60 grayscale'}
      `}
    >
      {/* Icon */}
      <div className="flex justify-center mb-3">
        {badge.is_earned ? (
          <IconComponent size={40} className={rarityIconColors[badge.rarity]} />
        ) : (
          <Lock size={40} className="text-gray-400" />
        )}
      </div>

      {/* Name */}
      <h4 className="text-center font-semibold text-sm mb-1 text-gray-900 dark:text-white">
        {badge.is_earned ? badge.name : '???'}
      </h4>

      {/* Description */}
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
        {badge.is_earned ? badge.description : 'Badge bloqueado'}
      </p>

      {/* Rarity stars */}
      <div className="flex justify-center gap-0.5 mb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`text-sm ${
              i < rarityStars[badge.rarity]
                ? 'text-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          >
            ★
          </span>
        ))}
      </div>

      {/* Progress (if not earned) */}
      {!badge.is_earned && badge.progress !== undefined && badge.progress !== null && (
        <div className="mt-2">
          <div className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
              style={{ width: `${badge.progress * 100}%` }}
            />
          </div>
          <p className="text-center text-xs text-gray-400 mt-1">
            {Math.round(badge.progress * 100)}%
          </p>
        </div>
      )}

      {/* Points reward */}
      {badge.is_earned && (
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1">
          +{badge.points_reward} pts
        </p>
      )}

      {/* New badge indicator */}
      {badge.is_earned && !badge.seen_at && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse font-medium">
          NOVO
        </div>
      )}
    </div>
  )
}
