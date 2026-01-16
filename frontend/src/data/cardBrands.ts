export interface CardBrand {
  id: string
  name: string
  domain: string
  hasLocalLogo: boolean
  category?: 'credit' | 'debit' | 'voucher'
}

export const cardBrands: CardBrand[] = [
  { id: 'visa', name: 'Visa', domain: 'visa.com.br', hasLocalLogo: true },
  { id: 'mastercard', name: 'Mastercard', domain: 'mastercard.com.br', hasLocalLogo: true },
  { id: 'elo', name: 'Elo', domain: 'elo.com.br', hasLocalLogo: true },
  { id: 'amex', name: 'American Express', domain: 'americanexpress.com', hasLocalLogo: true },
  { id: 'hipercard', name: 'Hipercard', domain: 'hipercard.com.br', hasLocalLogo: true },
  { id: 'diners', name: 'Diners Club', domain: 'dinersclub.com', hasLocalLogo: true },
  { id: 'discover', name: 'Discover', domain: 'discover.com', hasLocalLogo: false },
  { id: 'jcb', name: 'JCB', domain: 'jcb.co.jp', hasLocalLogo: false },
  { id: 'aura', name: 'Aura', domain: 'aura.com.br', hasLocalLogo: false },
  // Vouchers
  { id: 'alelo', name: 'Alelo', domain: 'alelo.com.br', hasLocalLogo: true, category: 'voucher' },
  { id: 'vr', name: 'VR', domain: 'vr.com.br', hasLocalLogo: true, category: 'voucher' },
  { id: 'ticket', name: 'Ticket', domain: 'ticket.com.br', hasLocalLogo: false, category: 'voucher' },
  { id: 'pluxee', name: 'Pluxee', domain: 'pluxee.com.br', hasLocalLogo: false, category: 'voucher' },
]

export function getCardBrandById(id: string): CardBrand | undefined {
  return cardBrands.find(b => b.id === id)
}

export function getCardBrandByName(name: string): CardBrand | undefined {
  return cardBrands.find(b => b.name.toLowerCase() === name.toLowerCase())
}

// Map from old card_brand names to new IDs
export function normalizeCardBrandToId(brandNameOrId: string | null | undefined): string | null {
  if (!brandNameOrId) return null

  // Check if it's already an ID
  const byId = getCardBrandById(brandNameOrId.toLowerCase())
  if (byId) return byId.id

  // Try to find by name
  const byName = getCardBrandByName(brandNameOrId)
  if (byName) return byName.id

  // Special cases for common variations
  const normalized = brandNameOrId.toLowerCase().trim()
  if (normalized.includes('american') || normalized === 'amex') return 'amex'
  if (normalized.includes('diners')) return 'diners'

  return null
}
