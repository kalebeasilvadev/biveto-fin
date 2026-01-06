import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { documentsApi, transactionsApi, accountsApi, categoriesApi, getApiErrorMessage } from '../services/api'
import { Upload as UploadIcon, Camera, Check, X, PenLine, AlertCircle, Image, CreditCard, Repeat, FileSpreadsheet } from 'lucide-react'
import { clsx } from 'clsx'

interface ExtractedItem {
  description: string
  amount: number
  date: string | null
  category: string | null
  confidence: number
  is_installment?: boolean
  installment_current?: number | null
  installment_total?: number | null
}

// Mapeamento de categorias da LLM para nomes das categorias do sistema
const CATEGORY_MAP: Record<string, string> = {
  'alimentacao': 'Alimentação',
  'transporte': 'Transporte',
  'moradia': 'Moradia',
  'saude': 'Saúde',
  'educacao': 'Educação',
  'lazer': 'Lazer',
  'eletronicos': 'Lazer',
  'roupas': 'Vestuário',
  'mercado': 'Mercado',
  'assinaturas': 'Contas',
  'cartao': 'Contas',
  'servicos': 'Outros',
  'outros': 'Outros',
}

interface Document {
  id: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  extracted_items: ExtractedItem[]
  is_duplicate?: boolean
}

type Mode = 'select' | 'upload' | 'camera' | 'manual' | 'confirm'

export default function Upload() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('select')
  const [dragActive, setDragActive] = useState(false)
  const [document, setDocument] = useState<Document | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const spreadsheetInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    account_id: '',
    category_id: '',
    merchant_name: '',
    description: '',
    type: 'expense' as 'expense' | 'income',
    is_installment: false,
    installment_current: '',
    installment_total: '',
  })

  // Prevent accidental page reload when document is processed
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (document || mode === 'confirm') {
        e.preventDefault()
        e.returnValue = 'Você tem dados não salvos. Deseja realmente sair?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [document, mode])

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const accounts = accountsData?.data || []
  const categories = categoriesData?.data || []

  // Função para encontrar categoria por nome sugerido pela LLM
  const findCategoryId = (suggestedCategory: string | null): string => {
    if (!suggestedCategory || categories.length === 0) return ''

    const categoryName = CATEGORY_MAP[suggestedCategory.toLowerCase()] || suggestedCategory
    const found = categories.find(
      (cat: { name: string; type: string }) =>
        cat.name.toLowerCase() === categoryName.toLowerCase() && cat.type === 'expense'
    )
    return found ? String(found.id) : ''
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(file),
    onSuccess: (response) => {
      setUploadError(null)
      const doc = response.data as Document
      setDocument(doc)
      setMode('confirm')
      stopCamera()

      if (doc.extracted_items && doc.extracted_items.length > 0) {
        const firstItem = doc.extracted_items[0]
        setFormData((prev) => ({
          ...prev,
          amount: Math.abs(firstItem.amount)?.toString() || '',
          date: firstItem.date || prev.date,
          merchant_name: firstItem.description || '',
          category_id: findCategoryId(firstItem.category),
          is_installment: firstItem.is_installment || false,
          installment_current: firstItem.installment_current?.toString() || '',
          installment_total: firstItem.installment_total?.toString() || '',
        }))
      }
    },
    onError: (error: unknown) => {
      setUploadError(getApiErrorMessage(error, 'Erro ao processar documento'))
    },
  })

  const confirmMutation = useMutation({
    mutationFn: (data: unknown) => transactionsApi.confirm(data),
    onSuccess: () => navigate('/transactions'),
  })

  const createMutation = useMutation({
    mutationFn: (data: unknown) => transactionsApi.create(data),
    onSuccess: () => navigate('/transactions'),
  })

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const files = e.dataTransfer.files
    if (files?.[0]) {
      uploadMutation.mutate(files[0])
    }
  }, [uploadMutation])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.[0]) {
      uploadMutation.mutate(files[0])
    }
  }

  // Start camera for live preview
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setMode('camera')
    } catch (err) {
      console.error('Camera error:', err)
      // Fallback to file input with capture
      cameraInputRef.current?.click()
    }
  }

  // Stop camera stream
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setCapturedImage(null)
  }

  // Capture photo from video stream
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageData = canvas.toDataURL('image/jpeg', 0.8)
        setCapturedImage(imageData)
      }
    }
  }

  // Convert base64 to File and upload
  const uploadCapturedImage = async () => {
    if (!capturedImage) return

    const response = await fetch(capturedImage)
    const blob = await response.blob()
    const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' })
    uploadMutation.mutate(file)
  }

  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null)
  }

  const handleConfirm = () => {
    if (document) {
      confirmMutation.mutate({
        document_id: document.id,
        amount: parseFloat(formData.amount),
        date: formData.date,
        account_id: parseInt(formData.account_id),
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        merchant_name: formData.merchant_name || null,
        is_installment: formData.is_installment,
        installment_current: formData.is_installment && formData.installment_current ? parseInt(formData.installment_current) : null,
        installment_total: formData.is_installment && formData.installment_total ? parseInt(formData.installment_total) : null,
      })
    }
  }

  const handleManualSubmit = () => {
    createMutation.mutate({
      type: formData.type,
      amount: parseFloat(formData.amount),
      date: formData.date,
      account_id: parseInt(formData.account_id),
      category_id: formData.category_id ? parseInt(formData.category_id) : null,
      merchant_name: formData.merchant_name || null,
      description: formData.description || null,
    })
  }

  const resetForm = () => {
    stopCamera()
    setMode('select')
    setDocument(null)
    setUploadError(null)
    setCapturedImage(null)
    setFormData({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      account_id: '',
      category_id: '',
      merchant_name: '',
      description: '',
      type: 'expense',
      is_installment: false,
      installment_current: '',
      installment_total: '',
    })
  }

  // Camera mode - full screen capture
  if (mode === 'camera') {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Top bar with close button - always visible */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4 safe-area-top">
          <button
            onClick={() => { stopCamera(); setMode('select') }}
            className="flex items-center gap-2 text-white bg-black/50 px-4 py-2 rounded-full"
          >
            <X size={20} />
            <span className="text-sm font-medium">Cancelar</span>
          </button>
        </div>

        {/* Camera preview or captured image */}
        <div className="flex-1 relative overflow-hidden">
          {!capturedImage ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <img
              src={capturedImage}
              alt="Captured"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Overlay guide */}
          {!capturedImage && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white/50 rounded-lg w-[85%] h-[60%] flex items-center justify-center">
                <p className="text-white/70 text-sm bg-black/30 px-3 py-1 rounded">
                  Posicione o comprovante aqui
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-black/80 p-4 pb-8 safe-area-bottom">
          {uploadMutation.isPending ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
              <p className="text-white">Processando...</p>
            </div>
          ) : !capturedImage ? (
            <div className="flex items-center justify-center">
              <button
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
              >
                <div className="w-14 h-14 rounded-full border-4 border-gray-800" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={retakePhoto}
                className="flex flex-col items-center gap-1 text-white"
              >
                <X size={24} />
                <span className="text-xs">Refazer</span>
              </button>
              <button
                onClick={uploadCapturedImage}
                className="flex flex-col items-center gap-1 text-green-400"
              >
                <Check size={32} />
                <span className="text-xs">Usar foto</span>
              </button>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="absolute bottom-24 left-4 right-4 bg-red-500 text-white p-3 rounded-lg">
            {uploadError}
          </div>
        )}
      </div>
    )
  }

  // Selection screen
  if (mode === 'select') {
    return (
      <div className="max-w-lg mx-auto space-y-6 pb-20">
        <h1 className="text-2xl font-bold text-gray-900">Adicionar Transação</h1>

        <div className="grid grid-cols-1 gap-4">
          {/* Camera - Primary action for mobile */}
          <button
            onClick={startCamera}
            className="card bg-primary-50 border-primary-200 hover:bg-primary-100 transition-colors text-left p-6 flex items-center gap-4"
          >
            <div className="p-3 bg-primary-100 rounded-xl">
              <Camera className="text-primary-600" size={32} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg">Tirar Foto</p>
              <p className="text-sm text-gray-600">Use a câmera para capturar o comprovante</p>
            </div>
          </button>

          {/* Hidden camera input for fallback */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
          />

          <div className="grid grid-cols-2 gap-4">
            {/* Gallery */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="card hover:border-primary-500 hover:bg-primary-50 transition-colors text-center py-6"
            >
              <Image className="mx-auto text-primary-600 mb-2" size={32} />
              <p className="font-medium text-gray-900">Galeria</p>
              <p className="text-xs text-gray-500 mt-1">Imagem ou PDF</p>
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
              onClick={() => setMode('manual')}
              className="card hover:border-primary-500 hover:bg-primary-50 transition-colors text-center py-6"
            >
              <PenLine className="mx-auto text-primary-600 mb-2" size={32} />
              <p className="font-medium text-gray-900">Manual</p>
              <p className="text-xs text-gray-500 mt-1">Digitar valores</p>
            </button>
          </div>

          {/* Import spreadsheet */}
          <button
            onClick={() => spreadsheetInputRef.current?.click()}
            className="card bg-emerald-50 border-emerald-200 hover:bg-emerald-100 transition-colors text-left p-4 flex items-center gap-4"
          >
            <div className="p-3 bg-emerald-100 rounded-xl">
              <FileSpreadsheet className="text-emerald-600" size={28} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Importar Extrato</p>
              <p className="text-sm text-gray-600">CSV ou Excel do banco</p>
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

        {uploadMutation.isPending && (
          <div className="card flex items-center justify-center gap-3 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            <p className="text-gray-600">Processando documento...</p>
          </div>
        )}

        {uploadError && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
            <X size={20} />
            {uploadError}
          </div>
        )}
      </div>
    )
  }

  // Upload mode (drag & drop - mainly for desktop)
  if (mode === 'upload') {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Upload de Documento</h1>
          <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={clsx(
            'card border-2 border-dashed text-center py-12 transition-colors',
            dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
          )}
        >
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
          />

          {uploadMutation.isPending ? (
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
              <p className="text-gray-600">Processando documento...</p>
            </div>
          ) : (
            <>
              <UploadIcon className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600 mb-4">Arraste uma foto ou PDF</p>
              <label
                htmlFor="file-upload"
                className="btn-primary inline-flex items-center gap-2 cursor-pointer"
              >
                <Camera size={18} />
                Escolher arquivo
              </label>
            </>
          )}
        </div>

        {(uploadMutation.isError || uploadError) && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
            <X size={20} />
            {uploadError || 'Erro ao processar documento.'}
          </div>
        )}

        <button onClick={() => setMode('manual')} className="w-full text-center text-primary-600 hover:underline">
          Ou digite manualmente
        </button>
      </div>
    )
  }

  // Transaction form (manual or confirmation)
  const isManual = mode === 'manual'
  const isPending = isManual ? createMutation.isPending : confirmMutation.isPending

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isManual ? 'Nova Transação' : 'Confirmar Transação'}
        </h1>
        <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
      </div>

      <div className="card space-y-4">
        {/* Duplicate alert */}
        {!isManual && document?.is_duplicate && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm">
            Este documento já foi enviado anteriormente.
          </div>
        )}

        {/* Document status with summary */}
        {!isManual && document && document.status === 'completed' && document.extracted_items && document.extracted_items.length > 0 && (
          <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <CreditCard className="text-primary-600" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Fatura processada</p>
                  <p className="text-xs text-gray-500">
                    {document.extracted_items.length} transação(ões) encontrada(s)
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total despesas</p>
                <p className="font-bold text-lg text-gray-900">
                  R$ {document.extracted_items
                    .filter(item => item.amount > 0)
                    .reduce((sum, item) => sum + item.amount, 0)
                    .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Installments summary */}
            {document.extracted_items.some(item => item.is_installment) && (
              <div className="flex items-center gap-2 pt-2 border-t border-primary-100">
                <Repeat size={14} className="text-blue-600" />
                <span className="text-xs text-blue-700">
                  {document.extracted_items.filter(item => item.is_installment).length} compra(s) parcelada(s) detectada(s)
                </span>
              </div>
            )}
          </div>
        )}

        {!isManual && document && document.status === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <X className="text-red-500" size={18} />
            <span className="text-red-700 text-sm">Falha no processamento do documento</span>
          </div>
        )}

        {!isManual && document && document.status === 'processing' && (
          <div className="flex items-center gap-3 p-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
            <span className="text-gray-600">Processando documento...</span>
          </div>
        )}

        {/* Extracted items list */}
        {!isManual && document?.extracted_items && document.extracted_items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Transações detectadas ({document.extracted_items.length})
              </label>
              {document.extracted_items.length > 1 && (
                <span className="text-xs text-gray-500">Selecione para editar</span>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 -mx-2 px-2">
              {document.extracted_items.map((item, index) => (
                <button
                  key={index}
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    amount: Math.abs(item.amount).toString(),
                    date: item.date || prev.date,
                    merchant_name: item.description,
                    category_id: findCategoryId(item.category),
                    is_installment: item.is_installment || false,
                    installment_current: item.installment_current?.toString() || '',
                    installment_total: item.installment_total?.toString() || '',
                  }))}
                  className={clsx(
                    'w-full p-3 rounded-xl border-2 text-left transition-all',
                    formData.merchant_name === item.description
                      ? 'border-primary-500 bg-primary-50 shadow-sm'
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                  )}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 truncate">{item.description}</p>
                        {item.is_installment && item.installment_current && item.installment_total && (
                          <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                            {item.installment_current}/{item.installment_total}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {item.date && (
                          <span>{new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        )}
                        {item.category && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{item.category}</span>
                          </>
                        )}
                        {item.is_installment && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600">Parcela {item.installment_current} de {item.installment_total}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={clsx(
                        'font-bold text-lg',
                        item.amount < 0 ? 'text-green-600' : 'text-gray-900'
                      )}>
                        {item.amount < 0 ? '+' : ''} R$ {Math.abs(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      {item.is_installment && item.installment_total && (
                        <p className="text-xs text-gray-400">
                          Total: R$ {(Math.abs(item.amount) * item.installment_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>
                  {formData.merchant_name === item.description && (
                    <div className="mt-2 pt-2 border-t border-primary-200 flex items-center gap-1 text-xs text-primary-600">
                      <Check size={14} />
                      Selecionado para confirmar
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Type selector (manual only) */}
        {isManual && (
          <div className="flex gap-2">
            <button
              onClick={() => setFormData({ ...formData, type: 'expense' })}
              className={clsx(
                'flex-1 py-3 rounded-lg font-medium transition-colors',
                formData.type === 'expense'
                  ? 'bg-red-100 text-red-700 border-2 border-red-500'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              Despesa
            </button>
            <button
              onClick={() => setFormData({ ...formData, type: 'income' })}
              className={clsx(
                'flex-1 py-3 rounded-lg font-medium transition-colors',
                formData.type === 'income'
                  ? 'bg-green-100 text-green-700 border-2 border-green-500'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              Receita
            </button>
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="input text-2xl font-bold"
            placeholder="0,00"
          />
        </div>

        {/* Account */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Conta *</label>
          {accounts.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm">
                <p className="text-yellow-800 font-medium">Nenhuma conta cadastrada</p>
                <Link to="/accounts" className="text-yellow-600 hover:underline">
                  Clique aqui para criar uma conta
                </Link>
              </div>
            </div>
          ) : (
            <select
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              className="input"
            >
              <option value="">Selecione</option>
              {accounts.map((acc: { id: number; name: string }) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
          <select
            value={formData.category_id}
            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
            className="input"
          >
            <option value="">Selecione</option>
            {categories
              .filter((cat: { type: string }) =>
                isManual ? cat.type === formData.type : cat.type === 'expense'
              )
              .map((cat: { id: number; name: string }) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="input"
          />
        </div>

        {/* Installment section */}
        {!isManual && (
          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_installment}
                  onChange={(e) => setFormData({
                    ...formData,
                    is_installment: e.target.checked,
                    installment_current: e.target.checked ? (formData.installment_current || '1') : '',
                    installment_total: e.target.checked ? (formData.installment_total || '') : '',
                  })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Compra parcelada</span>
              </label>
              {formData.is_installment && formData.installment_current && formData.installment_total && (
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                  {formData.installment_current}/{formData.installment_total}
                </span>
              )}
            </div>

            {formData.is_installment && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">Parcela atual</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.installment_current}
                    onChange={(e) => setFormData({ ...formData, installment_current: e.target.value })}
                    className="input text-center"
                    placeholder="1"
                  />
                </div>
                <div className="flex items-end pb-2 text-gray-400">de</div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">Total de parcelas</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.installment_total}
                    onChange={(e) => setFormData({ ...formData, installment_total: e.target.value })}
                    className="input text-center"
                    placeholder="12"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description / Merchant */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isManual ? 'Descrição' : 'Estabelecimento'}
          </label>
          <input
            type="text"
            value={isManual ? formData.description : formData.merchant_name}
            onChange={(e) =>
              setFormData({
                ...formData,
                [isManual ? 'description' : 'merchant_name']: e.target.value,
              })
            }
            className="input"
            placeholder={isManual ? 'Descrição da transação' : 'Nome do estabelecimento'}
          />
        </div>

        <button
          onClick={isManual ? handleManualSubmit : handleConfirm}
          disabled={!formData.amount || !formData.account_id || isPending}
          className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
        >
          {isPending ? 'Salvando...' : (
            <>
              <Check size={20} />
              {isManual ? 'Salvar' : 'Confirmar'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
