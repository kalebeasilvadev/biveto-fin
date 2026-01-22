import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Check, AlertCircle } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (file: File) => void
  onCancel: () => void
  isUploading: boolean
  uploadError: string | null
}

// Detect iOS for native camera usage (better quality than getUserMedia which is limited to 720p)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

export default function CameraCapture({
  onCapture,
  onCancel,
  isUploading,
  uploadError,
}: CameraCaptureProps) {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [videoResolution, setVideoResolution] = useState<{ width: number; height: number } | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // iOS Safari limits getUserMedia to 720p - use native camera for better quality
  const useNativeCamera = isIOS

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setCapturedImage(null)
  }, [cameraStream])

  const startCamera = useCallback(async () => {
    // On iOS, use native camera directly for better quality
    if (useNativeCamera) {
      // Trigger native camera input directly
      fileInputRef.current?.click()
      return
    }

    try {
      setCameraLoading(true)

      // Check if media API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Fallback to native camera
        fileInputRef.current?.click()
        setCameraLoading(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          aspectRatio: { ideal: 16 / 9 },
        },
        audio: false
      })

      // Apply continuous focus if supported
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities & { focusMode?: string[] }
        if (capabilities.focusMode?.includes('continuous')) {
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet]
          })
        }

        // Save actual video resolution for debug
        const settings = videoTrack.getSettings()
        if (settings.width && settings.height) {
          setVideoResolution({ width: settings.width, height: settings.height })
        }
      }

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

      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      if (errorMessage.includes('Permission') || errorMessage.includes('NotAllowed')) {
        setCameraError('Camera permission denied. Please allow access in settings.')
      } else if (errorMessage.includes('NotFound') || errorMessage.includes('DevicesNotFound')) {
        setCameraError('Camera not found on this device.')
      } else {
        // Fallback to native camera
        fileInputRef.current?.click()
      }
    }
  }, [stopCamera, useNativeCamera])

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
        const imageData = canvas.toDataURL('image/jpeg', 0.95)
        setCapturedImage(imageData)
      }
    }
  }

  const uploadCapturedImage = async () => {
    if (!capturedImage) return

    // Stop camera to save battery during upload
    stopCamera()

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

  // Handle native camera capture
  const handleNativeCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) {
      // User cancelled - go back
      onCancel()
      return
    }
    onCapture(files[0])
  }

  // Error screen
  if (cameraError) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-6">
        <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-red-500/20">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h2 className="text-white text-lg font-semibold">Camera unavailable</h2>
          <p className="text-gray-400 text-sm">{cameraError}</p>

          {uploadError && (
            <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-xl text-sm">
              {uploadError}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              onClick={handleCancel}
              className="w-full bg-gray-700 text-white py-3 px-4 rounded-xl font-medium"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Hidden input for fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeCapture}
          className="hidden"
        />
      </div>
    )
  }

  // For iOS/native camera, show loading while waiting for camera app
  if (useNativeCamera || (!cameraStream && !capturedImage && !cameraLoading)) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
          <p className="text-white text-sm">Opening camera...</p>
        </div>

        {/* Hidden input for native camera */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeCapture}
          className="hidden"
        />
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
            <span className="text-sm font-medium">Cancel</span>
          </button>
        </div>
      </div>

      {/* Camera preview */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {cameraLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
              <p className="text-white text-sm">Starting camera...</p>
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

        {/* Resolution indicator */}
        {!capturedImage && videoResolution && (
          <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded z-10">
            {videoResolution.width}x{videoResolution.height}
          </div>
        )}

        {/* Overlay guide */}
        {!capturedImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-2 border-white/50 rounded-lg w-[85%] h-[60%] flex items-center justify-center">
              <p className="text-white/70 text-sm bg-black/30 px-3 py-1 rounded">
                Position receipt here
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
            <p className="text-white">Processing...</p>
          </div>
        ) : cameraLoading ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-white/70 text-sm">Waiting for camera...</p>
          </div>
        ) : !capturedImage ? (
          <div className="flex items-center justify-center">
            {/* Capture button */}
            <button
              onClick={capturePhoto}
              disabled={!cameraStream}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center disabled:opacity-50"
            >
              <div className="w-[72px] h-[72px] rounded-full border-4 border-gray-800" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={retakePhoto}
              className="flex flex-col items-center gap-1 text-white"
            >
              <X size={24} />
              <span className="text-xs">Retake</span>
            </button>
            <button
              onClick={uploadCapturedImage}
              className="flex flex-col items-center gap-1 text-green-400"
            >
              <Check size={32} />
              <span className="text-xs">Use photo</span>
            </button>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="absolute bottom-24 left-4 right-4 bg-red-500 text-white p-3 rounded-lg">
          {uploadError}
        </div>
      )}

      {/* Hidden input for fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativeCapture}
        className="hidden"
      />
    </div>
  )
}
