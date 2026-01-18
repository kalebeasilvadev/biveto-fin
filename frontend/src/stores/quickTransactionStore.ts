import { create } from 'zustand'

interface QuickTransactionStore {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useQuickTransactionStore = create<QuickTransactionStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
