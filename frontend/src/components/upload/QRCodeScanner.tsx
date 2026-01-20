import { useState, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { documentsApi, getApiErrorMessage } from '../../services/api'
import {
  QrCode,
  Camera,
  Image,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react'

interface NFCeItem {
  codigo: string | null
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario: number
  valor_total: number
  ncm: string | null
}

interface NFCeData {
  chave_acesso: string
  data_emissao: string
  cnpj_emitente: string
  nome_emitente: string
  valor_total: number
  itens: NFCeItem[]
  endereco_emitente: string | null
  forma_pagamento: string | null
}

interface QRCodeScanResult {
  qr_extraction_success: boolean
  qr_url: string | null
  qr_access_key: string | null
  qr_error: string | null
  nfce_fetch_success: boolean
  nfce_data: NFCeData | null
  nfce_error: string | null
  nfce_error_type: string | null
  fallback_suggested: boolean
  message: string | null
}

interface QRCodeScannerProps {
  onSuccess: (data: NFCeData) => void
  onCancel: () => void
  onFallbackToPhoto: () => void
}

export default function QRCodeScanner({
  onSuccess,
  onCancel,
  onFallbackToPhoto,
}: QRCodeScannerProps) {
  const [mode, setMode] = useState<'select' | 'camera' | 'processing'>('select')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const scanMutation = useMutation({
    mutationFn: (data: { image_base64?: string; url?: string }) =>
      documentsApi.scanQRCode(data),
    onSuccess: (response) => {
      const result = response.data as QRCodeScanResult

      if (result.nfce_fetch_success && result.nfce_data) {
        onSuccess(result.nfce_data)
      } else if (result.fallback_suggested) {
        setError(result.message || 'NFCe ainda não disponível. Tente usar a opção de foto.')
        setMode('select')
      } else {
        setError(result.message || result.qr_error || result.nfce_error || 'Erro ao processar QR Code')
        setMode('select')
      }
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Erro ao escanear QR Code'))
      setMode('select')
    },
  })

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null)
    setMode('processing')

    try {
      // Convert file to base64
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        scanMutation.mutate({ image_base64: base64 })
      }
      reader.onerror = () => {
        setError('Erro ao ler arquivo')
        setMode('select')
      }
      reader.readAsDataURL(file)
    } catch {
      setError('Erro ao processar arquivo')
      setMode('select')
    }
  }, [scanMutation])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.[0]) {
      handleFileSelect(files[0])
    }
    // Reset input for re-selection
    e.target.value = ''
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-2">
          <QrCode className="text-green-600" size={28} />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            QR Code do Cupom
          </h1>
        </div>
      </div>

      {/* Info */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
        <p className="text-sm text-green-800 dark:text-green-200">
          Escaneie o QR Code do cupom fiscal (NFCe) para obter os dados
          completos dos produtos, sem nomes truncados.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            {error.includes('não disponível') && (
              <button
                onClick={onFallbackToPhoto}
                className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
              >
                Usar foto do cupom
              </button>
            )}
          </div>
        </div>
      )}

      {/* Processing */}
      {mode === 'processing' && (
        <div className="card flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="animate-spin text-green-600" size={48} />
          <div className="text-center">
            <p className="font-medium text-gray-900 dark:text-white">
              Processando QR Code...
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Consultando dados na SEFAZ
            </p>
          </div>
        </div>
      )}

      {/* Selection Mode */}
      {mode === 'select' && (
        <div className="space-y-4">
          {/* Camera option */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={scanMutation.isPending}
            className="w-full card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-left p-6 flex items-center gap-4 disabled:opacity-50"
          >
            <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-xl">
              <Camera className="text-green-600" size={32} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-lg">
                Tirar Foto do QR Code
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Aponte para o QR Code no cupom
              </p>
            </div>
          </button>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
          />

          {/* Gallery option */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={scanMutation.isPending}
            className="w-full card hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left p-6 flex items-center gap-4 disabled:opacity-50"
          >
            <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-xl">
              <Image className="text-gray-600 dark:text-gray-400" size={32} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-lg">
                Selecionar da Galeria
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Escolha uma imagem com o QR Code
              </p>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />

          {/* Fallback option */}
          <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={onFallbackToPhoto}
              className="w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Prefere tirar foto do cupom inteiro?
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
