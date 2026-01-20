import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Check, Trash2, Eye, EyeOff, Image, Camera, AlertCircle, Shield, ExternalLink, ChevronRight } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (file: File) => void
  onCaptureBatch?: (files: File[]) => void
  onCancel: () => void
  isUploading: boolean
  uploadError: string | null
  allowMultiple?: boolean
}

interface CapturedPhoto {
  dataUrl: string
  file: File
}

export default function CameraCapture({
  onCapture,
  onCaptureBatch,
  onCancel,
  isUploading,
  uploadError,
  allowMultiple = false,
}: CameraCaptureProps) {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedImages, setCapturedImages] = useState<CapturedPhoto[]>([])
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [showGhostOverlay, setShowGhostOverlay] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_PHOTOS = 10

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setCapturedImage(null)
  }, [cameraStream])

  const startCamera = useCallback(async () => {
    try {
      setCameraLoading(true)

      // Verificar se a API de mídia está disponível
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('API_NOT_AVAILABLE')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })

      setCameraStream(stream)

      if (videoRef.current) {
        const video = videoRef.current
        video.srcObject = stream

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Camera timeout'))
          }, 8000)

          video.onloadedmetadata = () => {
            clearTimeout(timeout)
            video.play()
              .then(() => {
                setCameraLoading(false)
                resolve()
              })
              .catch((e) => {
                clearTimeout(timeout)
                reject(e)
              })
          }
          video.onerror = () => {
            clearTimeout(timeout)
            reject(new Error('Video error'))
          }
        })
      }
    } catch (err) {
      console.error('Camera error:', err)
      setCameraLoading(false)
      stopCamera()
      // Mostrar erro ao invés de cancelar silenciosamente
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (errorMessage === 'API_NOT_AVAILABLE' && isIOS) {
        // iOS com certificado não confiável - mostrar instruções
        setCameraError('IOS_CERT_REQUIRED')
      } else if (errorMessage === 'API_NOT_AVAILABLE') {
        // Outro navegador sem API - usar fallback
        setCameraError('USE_NATIVE')
      } else if (errorMessage.includes('Permission') || errorMessage.includes('NotAllowed')) {
        setCameraError('Permissão de câmera negada. Permita o acesso nas configurações.')
      } else if (errorMessage.includes('NotFound') || errorMessage.includes('DevicesNotFound')) {
        setCameraError('Câmera não encontrada neste dispositivo.')
      } else {
        setCameraError(`Erro ao acessar câmera: ${errorMessage}`)
      }
    }
  }, [stopCamera])

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageData = canvas.toDataURL('image/jpeg', 0.8)

        if (allowMultiple) {
          // Multi-capture mode: add to array
          const response = await fetch(imageData)
          const blob = await response.blob()
          const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
          setCapturedImages(prev => [...prev, { dataUrl: imageData, file }])
        } else {
          // Single capture mode: show preview
          setCapturedImage(imageData)
        }
      }
    }
  }

  const uploadCapturedImage = async () => {
    if (!capturedImage) return

    const response = await fetch(capturedImage)
    const blob = await response.blob()
    const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' })
    onCapture(file)
  }

  const uploadBatchImages = () => {
    if (capturedImages.length === 0) return
    if (onCaptureBatch) {
      const files = capturedImages.map(img => img.file)
      onCaptureBatch(files)
    }
  }

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index))
  }

  const retakePhoto = () => {
    setCapturedImage(null)
  }

  const handleCancel = () => {
    stopCamera()
    onCancel()
  }

  // Fallback: usar input nativo quando câmera não funciona
  const handleFallbackCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (allowMultiple) {
      // Processar múltiplos arquivos
      const newPhotos: CapturedPhoto[] = []
      for (const file of Array.from(files)) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
        newPhotos.push({ dataUrl, file })
      }
      setCapturedImages(prev => [...prev, ...newPhotos].slice(0, MAX_PHOTOS))
      setCameraError(null) // Limpar erro após sucesso
    } else {
      // Single file
      onCapture(files[0])
    }

    // Limpar input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Tela de instruções para iOS - instalar certificado
  if (cameraError === 'IOS_CERT_REQUIRED') {
    const certUrl = `${window.location.protocol}//${window.location.host}/certs/cert.pem`

    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-y-auto">
        <div className="p-4 safe-area-top">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-white bg-white/10 px-4 py-2 rounded-full"
          >
            <X size={20} />
            <span className="text-sm font-medium">Fechar</span>
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center">
              <Shield className="text-amber-500" size={40} />
            </div>
            <h2 className="text-white text-xl font-bold">Configuração Necessária</h2>
            <p className="text-gray-400 text-sm">
              Para usar a câmera no iPhone, você precisa instalar o certificado de segurança.
              Isso é necessário apenas uma vez.
            </p>
          </div>

          {/* Passos */}
          <div className="space-y-4">
            {/* Passo 1 */}
            <div className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium mb-2">Baixar o certificado</p>
                  <a
                    href={certUrl}
                    className="flex items-center justify-between bg-primary-600 text-white py-3 px-4 rounded-lg"
                  >
                    <span className="font-medium">Baixar Certificado</span>
                    <ExternalLink size={18} />
                  </a>
                  <p className="text-gray-500 text-xs mt-2">
                    Toque em "Permitir" quando o Safari perguntar
                  </p>
                </div>
              </div>
            </div>

            {/* Passo 2 */}
            <div className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">2</span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium mb-1">Instalar o perfil</p>
                  <p className="text-gray-400 text-sm">
                    Vá em <span className="text-white">Ajustes</span> → <span className="text-white">Perfil Baixado</span> → <span className="text-white">Instalar</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Passo 3 */}
            <div className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">3</span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium mb-1">Confiar no certificado</p>
                  <p className="text-gray-400 text-sm">
                    Vá em <span className="text-white">Ajustes</span> → <span className="text-white">Geral</span> → <span className="text-white">Sobre</span> → <span className="text-white">Conf. Certificados</span>
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    Ative a confiança para <span className="text-white">"{window.location.hostname}"</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Passo 4 */}
            <div className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">4</span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium mb-2">Recarregar a página</p>
                  <p className="text-gray-500 text-xs mb-2">
                    O Safari precisa recarregar para reconhecer o certificado
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex items-center justify-between w-full bg-green-600 text-white py-3 px-4 rounded-lg"
                  >
                    <span className="font-medium">Recarregar Página</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Fallback */}
          <div className="pt-4 border-t border-gray-800">
            <p className="text-gray-500 text-xs text-center mb-3">
              Ou use o modo alternativo (menos prático):
            </p>
            <button
              onClick={() => setCameraError('USE_NATIVE')}
              className="w-full bg-gray-800 text-gray-300 py-3 px-4 rounded-xl font-medium"
            >
              Usar câmera nativa do iOS
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Tela de erro/fallback genérico
  if (cameraError) {
    const isNativeFallback = cameraError === 'USE_NATIVE'

    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-6">
        <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${isNativeFallback ? 'bg-primary-500/20' : 'bg-red-500/20'}`}>
            {isNativeFallback ? (
              <Camera className="text-primary-500" size={32} />
            ) : (
              <AlertCircle className="text-red-500" size={32} />
            )}
          </div>
          <h2 className="text-white text-lg font-semibold">
            {isNativeFallback ? 'Usar Câmera do Dispositivo' : 'Câmera indisponível'}
          </h2>
          <p className="text-gray-400 text-sm">
            {isNativeFallback
              ? 'Toque no botão abaixo para tirar fotos usando a câmera nativa.'
              : cameraError}
          </p>

          <div className="space-y-3 pt-2">
            {/* Botão para usar galeria/câmera nativa */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-primary-600 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <Camera size={20} />
              Tirar Foto
            </button>

            {/* Mostrar fotos já capturadas */}
            {allowMultiple && capturedImages.length > 0 && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <Camera size={20} />
                  Tirar mais fotos ({capturedImages.length}/{MAX_PHOTOS})
                </button>
                <button
                  onClick={() => {
                    setCameraError(null)
                    setShowPreview(true)
                  }}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <Check size={20} />
                  Processar {capturedImages.length} foto{capturedImages.length !== 1 ? 's' : ''}
                </button>
              </>
            )}

            <button
              onClick={handleCancel}
              className="w-full bg-gray-700 text-white py-3 px-4 rounded-xl font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>

        {/* Input oculto para fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={allowMultiple}
          onChange={handleFallbackCapture}
          className="hidden"
        />
      </div>
    )
  }

  // Multi-capture PREVIEW mode (grid view)
  if (allowMultiple && showPreview && capturedImages.length > 0) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <canvas ref={canvasRef} className="hidden" />

        {/* Top bar */}
        <div className="bg-black/80 p-4 safe-area-top">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-2 text-white bg-black/50 px-4 py-2 rounded-full"
            >
              <Camera size={20} />
              <span className="text-sm font-medium">Voltar</span>
            </button>
            <span className="text-white text-sm">
              {capturedImages.length} foto{capturedImages.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-900">
          <div className="grid grid-cols-3 gap-2">
            {capturedImages.map((img, index) => (
              <div key={index} className="relative aspect-[3/4] rounded-lg overflow-hidden">
                <img
                  src={img.dataUrl}
                  alt={`Foto ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 p-1.5 bg-red-500 rounded-full text-white"
                >
                  <Trash2 size={16} />
                </button>
                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom controls */}
        <div className="bg-black/80 p-4 pb-8 safe-area-bottom">
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
              <p className="text-white">Processando {capturedImages.length} foto{capturedImages.length !== 1 ? 's' : ''}...</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              {capturedImages.length < MAX_PHOTOS && (
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex flex-col items-center gap-1 text-white"
                >
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                    <Camera size={28} className="text-white" />
                  </div>
                  <span className="text-xs">Mais fotos</span>
                </button>
              )}
              <button
                onClick={uploadBatchImages}
                className="flex flex-col items-center gap-1 text-green-400"
              >
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={32} className="text-white" />
                </div>
                <span className="text-xs">Processar {capturedImages.length}</span>
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

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4 safe-area-top">
        <div className="flex items-center justify-between">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-white bg-black/50 px-4 py-2 rounded-full"
          >
            <X size={20} />
            <span className="text-sm font-medium">Cancelar</span>
          </button>
          {allowMultiple && capturedImages.length > 0 && (
            <span className="text-white text-sm bg-black/50 px-3 py-1 rounded-full">
              {capturedImages.length} foto{capturedImages.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Camera preview */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {cameraLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
              <p className="text-white text-sm">Iniciando câmera...</p>
            </div>
          </div>
        )}
        {!capturedImage ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
          />
        ) : (
          <img
            src={capturedImage}
            alt="Captured"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Single capture overlay guide */}
        {!capturedImage && !allowMultiple && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-2 border-white/50 rounded-lg w-[85%] h-[60%] flex items-center justify-center">
              <p className="text-white/70 text-sm bg-black/30 px-3 py-1 rounded">
                Posicione o comprovante aqui
              </p>
            </div>
          </div>
        )}

        {/* Ghost Image Overlay - Multi capture mode */}
        {!capturedImage && allowMultiple && capturedImages.length > 0 && showGhostOverlay && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Ghost image: shows bottom 40% of last photo, positioned at top */}
            <img
              src={capturedImages[capturedImages.length - 1].dataUrl}
              alt="Guia de alinhamento"
              className="absolute top-0 left-0 w-full opacity-60"
              style={{
                clipPath: 'inset(60% 0 0 0)',
                transform: 'translateY(-60%)',
              }}
            />
            {/* Guide line for alignment - mais visível */}
            <div className="absolute top-[40%] left-0 right-0 border-t-4 border-dashed border-yellow-400" />
            <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-full bg-yellow-400 text-black text-sm font-bold px-4 py-1.5 rounded-t-lg shadow-lg">
              ↑ Alinhe aqui
            </div>
          </div>
        )}

        {/* Ghost overlay toggle button */}
        {!capturedImage && allowMultiple && capturedImages.length > 0 && (
          <button
            onClick={() => setShowGhostOverlay(!showGhostOverlay)}
            className="absolute top-20 right-4 z-20 flex items-center gap-2 bg-black/60 text-white px-3 py-2 rounded-full text-xs backdrop-blur-sm"
          >
            {showGhostOverlay ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>{showGhostOverlay ? 'Ocultar guia' : 'Mostrar guia'}</span>
          </button>
        )}

        {/* Progress indicator - left side */}
        {!capturedImage && allowMultiple && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
            {Array.from({ length: MAX_PHOTOS }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-5 rounded-full transition-colors ${
                  i < capturedImages.length
                    ? 'bg-green-500'
                    : i === capturedImages.length
                      ? 'bg-white/80 animate-pulse'
                      : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        )}

        {/* Instructions - Initial state */}
        {!capturedImage && allowMultiple && capturedImages.length === 0 && (
          <div className="absolute bottom-28 left-4 right-4 bg-black/80 text-white p-4 rounded-xl text-center backdrop-blur-sm z-10">
            <p className="font-semibold text-base mb-1">📸 Cupom Grande?</p>
            <p className="text-sm text-white/80 leading-relaxed">
              Comece pelo <span className="text-yellow-400 font-medium">TOPO</span> do cupom.
              Após cada foto, uma guia aparecerá para você continuar de onde parou.
            </p>
          </div>
        )}

        {/* Instructions - After first captures */}
        {!capturedImage && allowMultiple && capturedImages.length > 0 && capturedImages.length < 3 && (
          <div className="absolute bottom-28 left-4 right-4 bg-black/80 text-white p-3 rounded-xl text-center backdrop-blur-sm z-10">
            <p className="text-sm leading-relaxed">
              Alinhe a <span className="text-yellow-400 font-medium">linha amarela</span> com o final da foto anterior.
              Continue até capturar todo o cupom.
            </p>
          </div>
        )}

      </div>

      {/* Controls */}
      <div className="bg-black/80 p-4 pb-8 safe-area-bottom">
        {isUploading ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
            <p className="text-white">Processando...</p>
          </div>
        ) : cameraLoading ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-white/70 text-sm">Aguardando câmera...</p>
          </div>
        ) : !capturedImage ? (
          <div className="flex items-center justify-center gap-6">
            {/* View captured images button (multi mode) */}
            {allowMultiple && capturedImages.length > 0 && (
              <button
                onClick={() => setShowPreview(true)}
                className="flex flex-col items-center gap-1 text-white"
              >
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center relative">
                  <Image size={24} className="text-white" />
                  <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {capturedImages.length}
                  </span>
                </div>
                <span className="text-xs">Ver fotos</span>
              </button>
            )}

            {/* Capture button */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={capturePhoto}
                disabled={!cameraStream || (allowMultiple && capturedImages.length >= MAX_PHOTOS)}
                className="w-20 h-20 rounded-full bg-white flex items-center justify-center disabled:opacity-50"
              >
                <div className="w-[72px] h-[72px] rounded-full border-4 border-gray-800" />
              </button>
              {allowMultiple && (
                <span className="text-white/70 text-xs">
                  {capturedImages.length}/{MAX_PHOTOS}
                </span>
              )}
            </div>

            {/* Process batch button (only in multi mode with captures) */}
            {allowMultiple && capturedImages.length > 0 && (
              <button
                onClick={uploadBatchImages}
                className="flex flex-col items-center gap-1 text-green-400"
              >
                <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={28} className="text-white" />
                </div>
                <span className="text-xs">Processar</span>
              </button>
            )}
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
