import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, Share2, FileText, Image } from 'lucide-react'

/**
 * ShareTarget page - receives shared content from other apps
 *
 * This page handles the Web Share Target API.
 * When users share content to Biveto from other apps, this page:
 * 1. Receives the shared data (text, URL, or files)
 * 2. Processes it and redirects to the appropriate page
 *
 * For images/PDFs: redirects to /upload for OCR processing
 * For text/URLs: redirects to /upload with pre-filled description
 * For CSV files: redirects to /upload for import
 */
export default function ShareTarget() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'error'>('processing')
  const [sharedData, setSharedData] = useState<{
    title?: string
    text?: string
    url?: string
    files?: File[]
  }>({})

  useEffect(() => {
    const processSharedData = async () => {
      try {
        // Get data from URL params (for GET requests or text shares)
        const title = searchParams.get('title') || ''
        const text = searchParams.get('text') || ''
        const url = searchParams.get('url') || ''

        // Check if this is a POST request with files (handled by service worker)
        const pendingShare = sessionStorage.getItem('pendingShare')
        let files: File[] = []

        if (pendingShare) {
          const shareData = JSON.parse(pendingShare)
          sessionStorage.removeItem('pendingShare')

          // Convert base64 files back to File objects if present
          if (shareData.files && shareData.files.length > 0) {
            files = await Promise.all(
              shareData.files.map(async (fileData: { name: string; type: string; data: string }) => {
                const response = await fetch(fileData.data)
                const blob = await response.blob()
                return new File([blob], fileData.name, { type: fileData.type })
              })
            )
          }
        }

        setSharedData({ title, text, url, files })

        // Determine where to redirect based on shared content
        if (files.length > 0) {
          // Store files for upload page
          const fileData = await Promise.all(
            files.map(async (file) => ({
              name: file.name,
              type: file.type,
              data: await fileToBase64(file)
            }))
          )
          sessionStorage.setItem('sharedFiles', JSON.stringify(fileData))
          navigate('/upload?source=share')
        } else if (text || url) {
          // Store text data for upload page
          const description = [title, text, url].filter(Boolean).join('\n')
          sessionStorage.setItem('sharedText', description)
          navigate('/upload?source=share')
        } else {
          // No useful data, just go to upload
          navigate('/upload')
        }
      } catch (error) {
        console.error('Error processing shared data:', error)
        setStatus('error')
      }
    }

    processSharedData()
  }, [navigate, searchParams])

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
    })
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Share2 className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Erro ao processar
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Não foi possível processar o conteúdo compartilhado.
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="btn-primary"
          >
            Ir para Upload
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-900">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-biveto-light dark:bg-biveto/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-biveto animate-spin" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Processando...
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Preparando o conteúdo compartilhado
        </p>

        {/* Show what was shared */}
        {(sharedData.title || sharedData.text || sharedData.files?.length) && (
          <div className="mt-6 p-4 bg-white dark:bg-slate-800 rounded-xl text-left max-w-sm mx-auto">
            {sharedData.title && (
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {sharedData.title}
              </p>
            )}
            {sharedData.text && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                {sharedData.text}
              </p>
            )}
            {sharedData.files && sharedData.files.length > 0 && (
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
                {sharedData.files[0].type.startsWith('image/') ? (
                  <Image size={16} />
                ) : (
                  <FileText size={16} />
                )}
                <span>{sharedData.files.length} arquivo(s)</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
