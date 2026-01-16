export interface Bank {
  id: string
  name: string
  shortName: string
  domain: string
  color: string
  hasLocalLogo: boolean
}

export const banks: Bank[] = [
  { id: 'nubank', name: 'Nubank', shortName: 'Nubank', domain: 'nubank.com.br', color: '#820AD1', hasLocalLogo: true },
  { id: 'itau', name: 'Itaú Unibanco', shortName: 'Itaú', domain: 'itau.com.br', color: '#EC7000', hasLocalLogo: true },
  { id: 'bradesco', name: 'Bradesco', shortName: 'Bradesco', domain: 'bradesco.com.br', color: '#CC092F', hasLocalLogo: true },
  { id: 'santander', name: 'Santander Brasil', shortName: 'Santander', domain: 'santander.com.br', color: '#EC0000', hasLocalLogo: true },
  { id: 'bb', name: 'Banco do Brasil', shortName: 'BB', domain: 'bb.com.br', color: '#FFEF00', hasLocalLogo: true },
  { id: 'caixa', name: 'Caixa Econômica Federal', shortName: 'Caixa', domain: 'caixa.gov.br', color: '#005CA9', hasLocalLogo: true },
  { id: 'inter', name: 'Banco Inter', shortName: 'Inter', domain: 'bancointer.com.br', color: '#FF7A00', hasLocalLogo: true },
  { id: 'c6', name: 'C6 Bank', shortName: 'C6', domain: 'c6bank.com.br', color: '#242424', hasLocalLogo: true },
  { id: 'btg', name: 'BTG Pactual', shortName: 'BTG', domain: 'btgpactual.com', color: '#001E62', hasLocalLogo: true },
  { id: 'xp', name: 'XP Investimentos', shortName: 'XP', domain: 'xpi.com.br', color: '#000000', hasLocalLogo: true },
  { id: 'modal', name: 'Banco Modal', shortName: 'Modal', domain: 'modal.com.br', color: '#00A651', hasLocalLogo: true },
  { id: 'original', name: 'Banco Original', shortName: 'Original', domain: 'original.com.br', color: '#00A86B', hasLocalLogo: true },
  { id: 'pan', name: 'Banco Pan', shortName: 'Pan', domain: 'bancopan.com.br', color: '#00AEEF', hasLocalLogo: true },
  { id: 'next', name: 'Next', shortName: 'Next', domain: 'next.me', color: '#00FF87', hasLocalLogo: true },
  { id: 'neon', name: 'Neon', shortName: 'Neon', domain: 'neon.com.br', color: '#00E5FF', hasLocalLogo: true },
  { id: 'pagbank', name: 'PagBank', shortName: 'PagBank', domain: 'pagbank.com.br', color: '#00A859', hasLocalLogo: true },
  { id: 'picpay', name: 'PicPay', shortName: 'PicPay', domain: 'picpay.com', color: '#21C25E', hasLocalLogo: true },
  { id: 'mercadopago', name: 'Mercado Pago', shortName: 'Mercado Pago', domain: 'mercadopago.com.br', color: '#009EE3', hasLocalLogo: true },
  { id: 'will', name: 'Will Bank', shortName: 'Will', domain: 'willbank.com.br', color: '#FFD600', hasLocalLogo: true },
  { id: 'sofisa', name: 'Sofisa Direto', shortName: 'Sofisa', domain: 'sofisadireto.com.br', color: '#FF6600', hasLocalLogo: true },
  { id: 'bmg', name: 'Banco BMG', shortName: 'BMG', domain: 'bancobmg.com.br', color: '#00529B', hasLocalLogo: true },
  { id: 'daycoval', name: 'Banco Daycoval', shortName: 'Daycoval', domain: 'daycoval.com.br', color: '#0066B3', hasLocalLogo: true },
  { id: 'safra', name: 'Banco Safra', shortName: 'Safra', domain: 'safra.com.br', color: '#003366', hasLocalLogo: true },
  { id: 'sicredi', name: 'Sicredi', shortName: 'Sicredi', domain: 'sicredi.com.br', color: '#00594D', hasLocalLogo: true },
  { id: 'sicoob', name: 'Sicoob', shortName: 'Sicoob', domain: 'sicoob.com.br', color: '#003641', hasLocalLogo: true },
  { id: 'banrisul', name: 'Banrisul', shortName: 'Banrisul', domain: 'banrisul.com.br', color: '#0033A0', hasLocalLogo: true },
  { id: 'banestes', name: 'Banestes', shortName: 'Banestes', domain: 'banestes.com.br', color: '#00529B', hasLocalLogo: true },
  { id: 'bnb', name: 'Banco do Nordeste', shortName: 'BNB', domain: 'bnb.gov.br', color: '#E30613', hasLocalLogo: false },
  { id: 'basa', name: 'Banco da Amazônia', shortName: 'BASA', domain: 'basa.com.br', color: '#007749', hasLocalLogo: false },
  // Bancos digitais e fintechs
  { id: 'digio', name: 'Digio', shortName: 'Digio', domain: 'digio.com.br', color: '#0066FF', hasLocalLogo: true },
  { id: 'bv', name: 'BV Financeira', shortName: 'BV', domain: 'bv.com.br', color: '#00A0E4', hasLocalLogo: true },
  { id: 'iti', name: 'Iti Itaú', shortName: 'Iti', domain: 'iti.itau', color: '#FF6B00', hasLocalLogo: true },
  { id: 'noh', name: 'Noh', shortName: 'Noh', domain: 'noh.com.br', color: '#FF4081', hasLocalLogo: true },
  { id: '99pay', name: '99Pay', shortName: '99Pay', domain: '99app.com', color: '#FFCC00', hasLocalLogo: true },
  { id: 'rappi', name: 'Rappi', shortName: 'Rappi', domain: 'rappi.com.br', color: '#FF5A00', hasLocalLogo: true },
  // Lojas e varejo
  { id: 'magalu', name: 'Magalu', shortName: 'Magalu', domain: 'magazineluiza.com.br', color: '#0086FF', hasLocalLogo: true },
  { id: 'amazon', name: 'Amazon', shortName: 'Amazon', domain: 'amazon.com.br', color: '#FF9900', hasLocalLogo: true },
  { id: 'renner', name: 'Renner', shortName: 'Renner', domain: 'lojasrenner.com.br', color: '#E31837', hasLocalLogo: true },
  { id: 'riachuelo', name: 'Riachuelo', shortName: 'Riachuelo', domain: 'riachuelo.com.br', color: '#000000', hasLocalLogo: false },
  { id: 'marisa', name: 'Marisa', shortName: 'Marisa', domain: 'marisa.com.br', color: '#E91E63', hasLocalLogo: false },
  { id: 'casasbahia', name: 'Casas Bahia', shortName: 'Casas Bahia', domain: 'casasbahia.com.br', color: '#0066B3', hasLocalLogo: false },
  { id: 'pernambucanas', name: 'Pernambucanas', shortName: 'Pernamb.', domain: 'pernambucanas.com.br', color: '#E31837', hasLocalLogo: false },
  // Atacado e supermercados
  { id: 'carrefour', name: 'Carrefour', shortName: 'Carrefour', domain: 'carrefour.com.br', color: '#004E9A', hasLocalLogo: false },
  { id: 'samsclub', name: "Sam's Club", shortName: "Sam's", domain: 'samsclub.com.br', color: '#0060A9', hasLocalLogo: false },
  { id: 'atacadao', name: 'Atacadão', shortName: 'Atacadão', domain: 'atacadao.com.br', color: '#F7941D', hasLocalLogo: false },
  // Construção
  { id: 'leroymerlin', name: 'Leroy Merlin', shortName: 'Leroy', domain: 'leroymerlin.com.br', color: '#78BE20', hasLocalLogo: false },
  // Celebridades/Parcerias
  { id: 'meucarrefour', name: 'Meu Carrefour', shortName: 'Carrefour', domain: 'carrefour.com.br', color: '#004E9A', hasLocalLogo: false },
  { id: 'other', name: 'Outro banco', shortName: 'Outro', domain: '', color: '#6B7280', hasLocalLogo: false },
]

export function getBankById(id: string): Bank | undefined {
  return banks.find(b => b.id === id)
}

export function getBankColor(bankId: string | null | undefined): string {
  if (!bankId) return '#6B7280'
  const bank = getBankById(bankId)
  return bank?.color || '#6B7280'
}
