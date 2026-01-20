import { useRef, useState } from 'react'
import { Camera, Image, PenLine, FileSpreadsheet, X, Trash2, Layers, Receipt } from 'lucide-react'

interface SelectedFile {
  file: File
  preview: string
}

interface UploadSelectorProps {
  onCameraClick: () => void
  onCameraMultiClick: () => void
  onFileSelect: (file: File) => void
  onFilesSelect: (files: File[]) => void
  onManualClick: () => void
  isUploading: boolean
  uploadError: string | null
}

export default function UploadSelector({
  onCameraClick,
  onCameraMultiClick,
  onFileSelect,
  onFilesSelect,
  onManualClick,
  isUploading,
  uploadError,
}: UploadSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const spreadsheetInputRef = useRef<HTMLInputElement>(null)
  const multiFileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [showMultiPreview, setShowMultiPreview] = useState(false)

  const MAX_FILES = 10

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.[0]) {
      onFileSelect(files[0])
    }
  }

  const handleMultiFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Convert to array and limit to MAX_FILES
    const fileArray = Array.from(files).slice(0, MAX_FILES)

    // Create previews for each file
    const filesWithPreviews: SelectedFile[] = await Promise.all(
      fileArray.map(async (file) => {
        const preview = await createPreview(file)
        return { file, preview }
      })
    )

    // Adicionar às fotos existentes (não substituir)
    setSelectedFiles(prev => [...prev, ...filesWithPreviews].slice(0, MAX_FILES))
    setShowMultiPreview(true)

    // Clear the input
    if (multiFileInputRef.current) {
      multiFileInputRef.current.value = ''
    }
  }

  const createPreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      // For HEIC files, we can't preview them directly, show a placeholder
      if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
        resolve('')
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        resolve(reader.result as string)
      }
      reader.onerror = () => {
        resolve('')
      }
      reader.readAsDataURL(file)
    })
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    if (selectedFiles.length <= 1) {
      setShowMultiPreview(false)
    }
  }

  const cancelMultiSelect = () => {
    setSelectedFiles([])
    setShowMultiPreview(false)
  }

  const processMultiFiles = () => {
    if (selectedFiles.length === 0) return
    const files = selectedFiles.map(sf => sf.file)
    onFilesSelect(files)
    // Don't clear yet - let the parent handle the loading state
  }

  const handleCameraClick = () => {
    // Usar sempre o componente CameraCapture (funciona em iOS e Android)
    onCameraClick()
  }

  const handleCameraMultiClick = () => {
    // Usar sempre o componente CameraCapture com ghost overlay
    onCameraMultiClick()
  }

  // Multi-file preview mode
  if (showMultiPreview && selectedFiles.length > 0) {
    return (
      <div className="max-w-md mx-auto space-y-4 pb-20">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {selectedFiles.length} arquivo{selectedFiles.length !== 1 ? 's' : ''} selecionado{selectedFiles.length !== 1 ? 's' : ''}
          </h1>
          <button
            onClick={cancelMultiSelect}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* File grid */}
        <div className="grid grid-cols-3 gap-2">
          {selectedFiles.map((sf, index) => (
            <div key={index} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
              {sf.preview ? (
                <img
                  src={sf.preview}
                  alt={`Arquivo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Image className="mx-auto text-gray-400 mb-1" size={24} />
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate px-1">
                      {sf.file.name.split('.').pop()?.toUpperCase()}
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 p-1.5 bg-red-500 rounded-full text-white shadow-lg"
              >
                <Trash2 size={14} />
              </button>
              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                {index + 1}
              </span>
            </div>
          ))}

          {/* Add more button */}
          {selectedFiles.length < MAX_FILES && (
            <button
              onClick={() => multiFileInputRef.current?.click()}
              className="aspect-[3/4] rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
            >
              <div className="text-center">
                <Image className="mx-auto text-gray-400 mb-1" size={24} />
                <p className="text-xs text-gray-500 dark:text-gray-400">Adicionar</p>
              </div>
            </button>
          )}
        </div>

        {/* Process button */}
        <div className="space-y-3">
          {isUploading ? (
            <div className="card flex items-center justify-center gap-3 py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              <p className="text-gray-600 dark:text-gray-400">
                Processando {selectedFiles.length} arquivo{selectedFiles.length !== 1 ? 's' : ''}...
              </p>
            </div>
          ) : (
            <button
              onClick={processMultiFiles}
              disabled={selectedFiles.length === 0}
              className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-2"
            >
              <Receipt size={20} />
              Processar {selectedFiles.length} foto{selectedFiles.length !== 1 ? 's' : ''}
            </button>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Todas as fotos serão processadas como um único documento
          </p>
        </div>

        {uploadError && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center gap-2">
            <X size={20} />
            {uploadError}
          </div>
        )}

        {/* Hidden input for adding more files */}
        <input
          ref={multiFileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          onChange={handleMultiFileInput}
          className="hidden"
        />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20 min-h-[70vh] flex flex-col justify-center">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center">Adicionar Transação</h1>

      <div className="grid grid-cols-1 gap-4">
        {/* Camera - Primary action */}
        <button
          onClick={handleCameraClick}
          className="card bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-left p-6 flex items-center gap-4"
        >
          <div className="p-3 bg-primary-100 dark:bg-primary-900/50 rounded-xl">
            <Camera className="text-primary-600" size={32} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-lg">Tirar Foto</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Use a câmera para capturar o comprovante</p>
          </div>
        </button>

        {/* Hidden camera input for iOS fallback */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileInput}
          className="hidden"
        />

        {/* Multi-photo camera for large receipts */}
        <button
          onClick={handleCameraMultiClick}
          className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-left p-4 flex items-center gap-4"
        >
          <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
            <Layers className="text-amber-600" size={28} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Cupom Grande</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Múltiplas fotos de um cupom longo</p>
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
            accept="image/*,.pdf,.csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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

        {/* Multiple photos from gallery */}
        <button
          onClick={() => multiFileInputRef.current?.click()}
          className="card hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left p-4 flex items-center gap-4"
        >
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <Layers className="text-gray-600 dark:text-gray-400" size={24} />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Várias Fotos da Galeria</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Selecione até 10 fotos de um cupom</p>
          </div>
        </button>

        <input
          ref={multiFileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          onChange={handleMultiFileInput}
          className="hidden"
        />

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
