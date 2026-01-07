import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Check } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (file: File) => void
  onCancel: () => void
  isUploading: boolean
  uploadError: string | null
}

export default function CameraCapture({
  onCapture,
  onCancel,
  isUploading,
  uploadError,
}: CameraCaptureProps) {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [cameraLoading, setCameraLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
      onCancel()
    }
  }, [stopCamera, onCancel])

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const uploadCapturedImage = async () => {
    if (!capturedImage) return

    const response = await fetch(capturedImage)
    const blob = await response.blob()
    const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' })
    onCapture(file)
  }

  const retakePhoto = () => {
    setCapturedImage(null)
  }

  const handleCancel = () => {
    stopCamera()
    onCancel()
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4 safe-area-top">
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-white bg-black/50 px-4 py-2 rounded-full"
        >
          <X size={20} />
          <span className="text-sm font-medium">Cancelar</span>
        </button>
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
          <div className="flex items-center justify-center">
            <button
              onClick={capturePhoto}
              disabled={!cameraStream}
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center disabled:opacity-50"
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
