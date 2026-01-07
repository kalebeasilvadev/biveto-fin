import { Link } from 'react-router-dom'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionTo?: string
  actionOnClick?: () => void
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
  actionOnClick,
}: EmptyStateProps) {
  return (
    <div className="empty-state py-16">
      <div className="empty-state-icon">
        <Icon size={32} />
      </div>
      <h3 className="empty-state-title dark:text-slate-100">{title}</h3>
      <p className="empty-state-description dark:text-slate-400">{description}</p>
      {actionLabel && (actionTo || actionOnClick) && (
        <div className="mt-6">
          {actionTo ? (
            <Link to={actionTo} className="btn-primary">
              {actionLabel}
            </Link>
          ) : (
            <button onClick={actionOnClick} className="btn-primary">
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
