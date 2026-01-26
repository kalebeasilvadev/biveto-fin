import { useEffect, useState } from 'react'
import { Trophy, X } from 'lucide-react'
import * as Icons from 'lucide-react'
import { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Badge } from './BadgeCard'

interface AchievementToastProps {
  badge: Badge
  onClose: () => void
}

export function AchievementToast({ badge, onClose }: AchievementToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const navigate = useNavigate()
  const IconComponent = ((Icons as unknown) as Record<string, LucideIcon>)[badge.icon] || Icons.Award

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 100)

    // Confetti effect using CSS
    const confettiContainer = document.createElement('div')
    confettiContainer.className = 'fixed inset-0 pointer-events-none z-[60] overflow-hidden'
    confettiContainer.id = 'confetti-container'

    // Create confetti particles
    const colors = ['#1E3A5F', '#4ade80', '#fbbf24', '#f472b6', '#60a5fa']
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div')
      particle.className = 'absolute w-2 h-2 rounded-full animate-confetti'
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
      particle.style.left = `${Math.random() * 100}%`
      particle.style.top = '-10px'
      particle.style.animationDelay = `${Math.random() * 0.5}s`
      particle.style.animationDuration = `${1 + Math.random() * 1}s`
      confettiContainer.appendChild(particle)
    }

    document.body.appendChild(confettiContainer)

    // Auto-close after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300)
    }, 5000)

    return () => {
      clearTimeout(timer)
      const container = document.getElementById('confetti-container')
      if (container) {
        container.remove()
      }
    }
  }, [onClose])

  const handleViewAll = () => {
    setIsVisible(false)
    setTimeout(() => {
      onClose()
      navigate('/achievements')
    }, 300)
  }

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  return (
    <>
      {/* Add confetti keyframes */}
      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
      `}</style>

      <div
        className={`
          fixed top-4 left-1/2 -translate-x-1/2 z-50
          max-w-sm w-full mx-4
          transition-all duration-300
          ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
        `}
      >
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-yellow-400/50 overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 p-4 text-center relative">
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <Trophy className="mx-auto text-white mb-1" size={32} />
            <h3 className="text-white font-bold text-lg">Conquista Desbloqueada!</h3>
          </div>

          {/* Content */}
          <div className="p-4 text-center">
            <div className="flex justify-center mb-3">
              <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <IconComponent size={40} className="text-yellow-600" />
              </div>
            </div>

            <h4 className="font-bold text-lg mb-1 text-gray-900 dark:text-white">{badge.name}</h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
              {badge.description}
            </p>

            <div className="inline-flex items-center gap-1 bg-primary-50 dark:bg-slate-700 px-3 py-1 rounded-full">
              <span className="text-primary-600 dark:text-blue-400 font-semibold">
                +{badge.points_reward} pontos
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={handleViewAll}
              className="flex-1 py-3 text-primary-600 dark:text-blue-400 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Ver Conquistas
            </button>
            <button
              onClick={handleClose}
              className="flex-1 py-3 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors border-l border-gray-100 dark:border-slate-700"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
