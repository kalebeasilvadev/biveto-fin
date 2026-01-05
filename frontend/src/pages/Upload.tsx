import { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { documentsApi, transactionsApi, accountsApi, categoriesApi } from '../services/api'
import { Upload as UploadIcon, Camera, FileText, Check, X, PenLine, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface ExtractedItem {
  description: string
  amount: number
  date: string | null
  category: string | null
  confidence: number
}

interface Document {
  id: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  extracted_items: ExtractedItem[]
  is_duplicate?: boolean
}

type Mode = 'select' | 'upload' | 'manual' | 'confirm'

export default function Upload() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('select')
  const [dragActive, setDragActive] = useState(false)
  const [document, setDocument] = useState<Document | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    account_id: '',
    category_id: '',
    merchant_name: '',
    description: '',
    type: 'expense' as 'expense' | 'income',
  })

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

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(file),
    onSuccess: (response) => {
      setUploadError(null)
      const doc = response.data as Document
      setDocument(doc)
      setMode('confirm')

      // Se tiver itens extraídos, preencher formulário com o primeiro
      // (usuário pode selecionar outros depois)
      if (doc.extracted_items && doc.extracted_items.length > 0) {
        const firstItem = doc.extracted_items[0]
        setFormData((prev) => ({
          ...prev,
          amount: firstItem.amount?.toString() || '',
          date: firstItem.date || prev.date,
          merchant_name: firstItem.description || '',
          // Categoria será selecionada manualmente por enquanto
        }))
      }
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } }
      const message = err.response?.data?.detail || 'Erro ao processar documento'
      setUploadError(message)
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

  const handleConfirm = () => {
    if (document) {
      confirmMutation.mutate({
        document_id: document.id,
        amount: parseFloat(formData.amount),
        date: formData.date,
        account_id: parseInt(formData.account_id),
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        merchant_name: formData.merchant_name || null,
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
    setMode('select')
    setDocument(null)
    setUploadError(null)
    setFormData({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      account_id: '',
      category_id: '',
      merchant_name: '',
      description: '',
      type: 'expense',
    })
  }

  // Tela de seleção inicial
  if (mode === 'select') {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Adicionar Transação</h1>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMode('upload')}
            className="card hover:border-primary-500 hover:bg-primary-50 transition-colors text-center py-8"
          >
            <Camera className="mx-auto text-primary-600 mb-3" size={40} />
            <p className="font-medium text-gray-900">Foto/PDF</p>
            <p className="text-sm text-gray-500 mt-1">Upload de comprovante</p>
          </button>

          <button
            onClick={() => setMode('manual')}
            className="card hover:border-primary-500 hover:bg-primary-50 transition-colors text-center py-8"
          >
            <PenLine className="mx-auto text-primary-600 mb-3" size={40} />
            <p className="font-medium text-gray-900">Manual</p>
            <p className="text-sm text-gray-500 mt-1">Digitar valores</p>
          </button>
        </div>
      </div>
    )
  }

  // Tela de upload
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

  // Formulário de transação (manual ou confirmação de documento)
  const isManual = mode === 'manual'
  const isPending = isManual ? createMutation.isPending : confirmMutation.isPending

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isManual ? 'Nova Transação' : 'Confirmar Transação'}
        </h1>
        <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
      </div>

      <div className="card space-y-4">
        {/* Alerta de duplicata */}
        {!isManual && document?.is_duplicate && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm">
            ⚠️ Este documento já foi enviado anteriormente. Você pode confirmar novamente se desejar.
          </div>
        )}

        {/* Status do documento (apenas em modo confirm) */}
        {!isManual && document && (
          <div className="flex items-center gap-2 text-sm">
            <FileText size={16} className="text-gray-400" />
            <span className="text-gray-600">
              {document.status === 'completed' ? (
                <span className="text-green-600 flex items-center gap-1">
                  <Check size={16} /> {document.extracted_items?.length || 0} transações detectadas
                </span>
              ) : document.status === 'failed' ? (
                <span className="text-red-600">Falha no processamento</span>
              ) : (
                'Processando...'
              )}
            </span>
          </div>
        )}

        {/* Lista de itens extraídos - clique para selecionar */}
        {!isManual && document?.extracted_items && document.extracted_items.length > 1 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Selecione a transação:</label>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {document.extracted_items.map((item, index) => (
                <button
                  key={index}
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    amount: item.amount.toString(),
                    date: item.date || prev.date,
                    merchant_name: item.description,
                  }))}
                  className={clsx(
                    'w-full p-3 rounded-lg border text-left transition-colors',
                    formData.merchant_name === item.description
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{item.description}</p>
                      <p className="text-xs text-gray-500">
                        {item.date} • {item.category}
                      </p>
                    </div>
                    <span className="font-bold text-gray-900">
                      R$ {item.amount.toFixed(2)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tipo (apenas manual) */}
        {isManual && (
          <div className="flex gap-2">
            <button
              onClick={() => setFormData({ ...formData, type: 'expense' })}
              className={clsx(
                'flex-1 py-2 rounded-lg font-medium transition-colors',
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
                'flex-1 py-2 rounded-lg font-medium transition-colors',
                formData.type === 'income'
                  ? 'bg-green-100 text-green-700 border-2 border-green-500'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              Receita
            </button>
          </div>
        )}

        {/* Valor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="input text-2xl font-bold"
            placeholder="0,00"
          />
        </div>

        {/* Conta */}
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

        {/* Categoria */}
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

        {/* Data */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="input"
          />
        </div>

        {/* Estabelecimento / Descrição */}
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
          className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2"
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
