import { create } from 'zustand'

interface UploadStore {
  pendingFile: File | null
  setPendingFile: (file: File | null) => void
  clearPendingFile: () => void
}

export const useUploadStore = create<UploadStore>((set) => ({
  pendingFile: null,
  setPendingFile: (file) => set({ pendingFile: file }),
  clearPendingFile: () => set({ pendingFile: null }),
}))
