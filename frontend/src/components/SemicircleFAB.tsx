import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Camera, Image, PenLine, FileSpreadsheet } from 'lucide-react'
import { clsx } from 'clsx'

interface SemicircleFABProps {
  onFileSelect: (file: File) => void
  isOpen: boolean
  onToggle: (open: boolean) => void
}

interface FABOption {
  id: 'photo' | 'gallery' | 'manual' | 'statement'
  icon: typeof Camera
  label: string
  angle: number // degrees from center (0 = directly above)
  distance: number // pixels from FAB center
  color: string
  bgColor: string
}

const options: FABOption[] = [
  {
    id: 'photo',
    icon: Camera,
    label: 'Foto',
    angle: 0,
    distance: 85,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/50'
  },
  {
    id: 'gallery',
    icon: Image,
    label: 'Galeria',
    angle: -50,
    distance: 95,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50'
  },
  {
    id: 'manual',
    icon: PenLine,
    label: 'Manual',
    angle: 50,
    distance: 95,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/50'
  },
  {
    id: 'statement',
    icon: FileSpreadsheet,
    label: 'Extrato',
    angle: 0,
    distance: 155,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/50'
  },
]

// Calculate position based on angle and distance
// Angle 0 = directly above, negative = left, positive = right
function getPosition(angle: number, distance: number) {
  const radians = (angle - 90) * (Math.PI / 180) // -90 to make 0 point up
  const x = Math.cos(radians) * distance
  const y = Math.sin(radians) * distance
  return { x, y }
}

export default function SemicircleFAB({ onFileSelect, isOpen, onToggle }: SemicircleFABProps) {
  const navigate = useNavigate()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const statementInputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

  // Delay mount animation
  useEffect(() => {
    if (isOpen) {
      setMounted(true)
    } else {
      const timer = setTimeout(() => setMounted(false), 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleOptionClick = (id: FABOption['id']) => {
    switch (id) {
      case 'photo':
        // Open native camera directly
        cameraInputRef.current?.click()
        break
      case 'gallery':
        // Open file picker for images and PDFs
        galleryInputRef.current?.click()
        break
      case 'manual':
        // Navigate to manual form
        navigate('/upload?mode=manual')
        onToggle(false)
        break
      case 'statement':
        // Open file picker for CSV/Excel
        statementInputRef.current?.click()
        break
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.[0]) {
      onFileSelect(files[0])
      onToggle(false)
    }
    // Reset input to allow selecting the same file again
    e.target.value = ''
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => onToggle(false)}
        />
      )}

      {/* FAB Container */}
      <div className="relative -mt-5 flex-1 flex justify-center">
        {/* Semicircle Options */}
        {mounted && (
          <div className="absolute bottom-full mb-3 z-50">
            {options.map((option, index) => {
              const pos = getPosition(option.angle, option.distance)
              const delay = index * 40 // staggered animation

              return (
                <button
                  key={option.id}
                  onClick={() => handleOptionClick(option.id)}
                  className={clsx(
                    'absolute flex flex-col items-center gap-1 transition-all',
                    isOpen
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-50 pointer-events-none'
                  )}
                  style={{
                    transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)`,
                    transitionDelay: isOpen ? `${delay}ms` : '0ms',
                    transitionDuration: '200ms',
                    transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // spring effect
                  }}
                  aria-label={option.label}
                >
                  <div className={clsx(
                    'w-12 h-12 rounded-full flex items-center justify-center shadow-lg',
                    'bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700',
                    'active:scale-95 transition-transform'
                  )}>
                    <div className={clsx('p-2 rounded-full', option.bgColor)}>
                      <option.icon size={20} className={option.color} />
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-white drop-shadow-md bg-black/40 px-2 py-0.5 rounded-full">
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Main FAB Button */}
        <button
          onClick={() => onToggle(!isOpen)}
          aria-label="Adicionar"
          aria-expanded={isOpen}
          className="relative z-50"
        >
          <div className={clsx(
            'w-14 h-14 rounded-2xl gradient-biveto shadow-lg shadow-biveto/30 flex items-center justify-center text-white transition-all duration-200',
            isOpen ? 'rotate-45 scale-95' : 'active:scale-95'
          )}>
            <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
          </div>
        </button>

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,.pdf,.heic,.heif"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={statementInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </>
  )
}
