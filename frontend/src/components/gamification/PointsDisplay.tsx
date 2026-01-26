import { Zap } from 'lucide-react'

interface PointsDisplayProps {
  points: number
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

export function PointsDisplay({ points, size = 'md', showIcon = true }: PointsDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-3 py-1.5',
    lg: 'text-lg px-4 py-2',
  }

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20,
  }

  return (
    <div className={`
      inline-flex items-center gap-1.5
      bg-primary-50 dark:bg-primary-900/30
      text-primary-600 dark:text-blue-400
      rounded-full font-semibold
      ${sizeClasses[size]}
    `}>
      {showIcon && <Zap size={iconSizes[size]} />}
      <span>{points.toLocaleString('pt-BR')}</span>
      <span className="text-primary-400 dark:text-blue-500 font-normal">pts</span>
    </div>
  )
}
