import { useRef } from 'react'
import { Camera, Image, PenLine, FileSpreadsheet, X } from 'lucide-react'

interface UploadSelectorProps {
  onCameraClick: () => void
  onFileSelect: (file: File) => void
  onManualClick: () => void
  isUploading: boolean
  uploadError: string | null
}

export default function UploadSelector({
  onCameraClick,
  onFileSelect,
  onManualClick,
  isUploading,
  uploadError,
}: UploadSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const spreadsheetInputRef = useRef<HTMLInputElement>(null)

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.[0]) {
      onFileSelect(files[0])
    }
    // Reset input to allow selecting the same file again
    e.target.value = ''
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20 min-h-[70vh] flex flex-col justify-center">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center">Adicionar Transacao</h1>

      <div className="grid grid-cols-1 gap-4">
        {/* Camera - Primary action */}
        <button
          onClick={onCameraClick}
          className="card bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-left p-6 flex items-center gap-4"
        >
          <div className="p-3 bg-primary-100 dark:bg-primary-900/50 rounded-xl">
            <Camera className="text-primary-600" size={32} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-lg">Tirar Foto</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Use a camera para capturar o comprovante</p>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-4">
          {/* Gallery */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="card hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-center py-6"
          >
            <Image className="mx-auto text-primary-600 mb-2" size={32} />
            <p className="font-medium text-gray-900 dark:text-white">Galeria</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Imagem ou PDF</p>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.heic,.heif"
            onChange={handleFileInput}
            className="hidden"
          />

          {/* Manual */}
          <button
            onClick={onManualClick}
            className="card hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-center py-6"
          >
            <PenLine className="mx-auto text-primary-600 mb-2" size={32} />
            <p className="font-medium text-gray-900 dark:text-white">Manual</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Digitar valores</p>
          </button>
        </div>

        {/* Import spreadsheet */}
        <button
          onClick={() => spreadsheetInputRef.current?.click()}
          className="card bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-left p-4 flex items-center gap-4"
        >
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl">
            <FileSpreadsheet className="text-emerald-600" size={28} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Importar Extrato</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">CSV ou Excel do banco</p>
          </div>
        </button>

        <input
          ref={spreadsheetInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {isUploading && (
        <div className="card flex items-center justify-center gap-3 py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          <p className="text-gray-600 dark:text-gray-400">Processando documento...</p>
        </div>
      )}

      {uploadError && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center gap-2">
          <X size={20} />
          {uploadError}
        </div>
      )}
    </div>
  )
}
