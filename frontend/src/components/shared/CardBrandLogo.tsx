import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { getCardBrandById, getCardBrandByName, CardBrand } from '../../data/cardBrands'
import { clsx } from 'clsx'

interface CardBrandLogoProps {
  brandId: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showFallback?: boolean
}

const sizeMap = {
  sm: { width: 36, height: 24, icon: 12, text: 'text-[8px]' },
  md: { width: 48, height: 32, icon: 16, text: 'text-[10px]' },
  lg: { width: 72, height: 48, icon: 24, text: 'text-xs' },
}

export default function CardBrandLogo({ brandId, size = 'md', className, showFallback = true }: CardBrandLogoProps) {
  const [imageError, setImageError] = useState(false)

  // Try to find by ID first, then by name (for backward compatibility)
  const brand = brandId
    ? getCardBrandById(brandId.toLowerCase()) || getCardBrandByName(brandId)
    : null

  const { width, height, icon, text } = sizeMap[size]

  // No brand selected
  if (!brand || !brandId) {
    if (!showFallback) return null
    return (
      <div
        className={clsx(
          'flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700',
          className
        )}
        style={{ width, height }}
      >
        <CreditCard size={icon} className="text-gray-400" />
      </div>
    )
  }

  // Try local SVG logo first
  if (brand.hasLocalLogo && !imageError) {
    return (
      <img
        src={`/logos/brands/${brand.id}.svg`}
        alt={brand.name}
        className={clsx('object-contain', className)}
        style={{ width, height }}
        onError={() => setImageError(true)}
      />
    )
  }

  // Text fallback
  return (
    <div
      className={clsx(
        'flex items-center justify-center rounded bg-gray-700 font-bold text-white',
        text,
        className
      )}
      style={{ width, height }}
    >
      {brand.name.slice(0, 4).toUpperCase()}
    </div>
  )
}

// Export a hook for getting brand info
export function useCardBrand(brandId: string | null | undefined): CardBrand | null {
  if (!brandId) return null
  return getCardBrandById(brandId.toLowerCase()) || getCardBrandByName(brandId) || null
}
