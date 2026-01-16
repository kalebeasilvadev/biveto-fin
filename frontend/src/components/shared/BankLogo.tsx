import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { getBankById, Bank } from '../../data/banks'
import { clsx } from 'clsx'

interface BankLogoProps {
  bankId: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showFallback?: boolean
}

const sizeMap = {
  sm: { px: 20, icon: 10, text: 'text-[8px]' },
  md: { px: 28, icon: 14, text: 'text-[10px]' },
  lg: { px: 40, icon: 20, text: 'text-sm' },
}

export default function BankLogo({ bankId, size = 'md', className, showFallback = true }: BankLogoProps) {
  const [imageError, setImageError] = useState(false)
  const bank = bankId ? getBankById(bankId) : null
  const { px, icon, text } = sizeMap[size]

  // No bank selected
  if (!bank || !bankId) {
    if (!showFallback) return null
    return (
      <div
        className={clsx(
          'flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700',
          className
        )}
        style={{ width: px, height: px }}
      >
        <Building2 size={icon} className="text-gray-400" />
      </div>
    )
  }

  // Try local SVG logo first (we have valid ones for nubank, picpay, mercadopago)
  if (bank.hasLocalLogo && !imageError) {
    return (
      <img
        src={`/logos/banks/${bankId}.svg`}
        alt={bank.name}
        className={clsx('rounded object-contain', className)}
        style={{ width: px, height: px }}
        onError={() => setImageError(true)}
      />
    )
  }

  // Styled initial fallback with bank color
  return (
    <div
      className={clsx(
        'flex items-center justify-center rounded font-bold text-white shadow-sm',
        text,
        className
      )}
      style={{
        width: px,
        height: px,
        backgroundColor: bank.color,
        // Use white text for dark backgrounds, dark text for light backgrounds
        color: isLightColor(bank.color) ? '#1a1a1a' : '#ffffff'
      }}
    >
      {bank.shortName.slice(0, 2).toUpperCase()}
    </div>
  )
}

// Helper to determine if a color is light (needs dark text)
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6
}

// Export a hook for getting bank info
export function useBank(bankId: string | null | undefined): Bank | null {
  return bankId ? getBankById(bankId) || null : null
}
