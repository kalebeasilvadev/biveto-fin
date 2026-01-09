import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentsApi, transactionsApi, accountsApi, categoriesApi, familyApi, creditCardsApi, invoicesApi, getApiErrorMessage } from '../services/api'
import { X, CreditCard, Repeat, Plus, AlertCircle } from 'lucide-react'
import {
  Document,
  TransactionFormData,
  UploadMode,
  CATEGORY_MAP,
  initialFormData,
} from '../types/upload'
import {
  CameraCapture,
  UploadSelector,
  ExtractedItemsList,
  TransactionForm,
} from '../components/upload'

export default function Upload() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<UploadMode>('select')
  const [document, setDocument] = useState<Document | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [formData, setFormData] = useState<TransactionFormData>(initialFormData)

  // Multi-select state
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
  const [batchAddSuccess, setBatchAddSuccess] = useState<number>(0)
  const [batchAddSkipped, setBatchAddSkipped] = useState<string[]>([])
  const [batchAddError, setBatchAddError] = useState<string | null>(null)
  // Duplicados pendentes que o usuário pode forçar
  const [pendingDuplicates, setPendingDuplicates] = useState<{ index: number; data: unknown; description: string; message: string }[]>([])

  // Credit card invoice state
  const [selectedCreditCardId, setSelectedCreditCardId] = useState<string>('')
  const [showCreateCardPrompt, setShowCreateCardPrompt] = useState(false)
  const [isCreatingCard, setIsCreatingCard] = useState(false)

  // Prevent accidental page reload
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

  // Queries
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.list,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const { data: familyData } = useQuery({
    queryKey: ['family-context'],
    queryFn: async () => {
      try {
        const response = await familyApi.getContext()
        return response.data as { member_count: number }
      } catch {
        return null
      }
    },
  })

  const { data: creditCardsData } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: creditCardsApi.list,
  })

  const accounts = accountsData?.data || []
  const categories = categoriesData?.data || []
  const creditCards = creditCardsData?.data || []
  const showOwnershipSelector = familyData && familyData.member_count >= 2

  // Check if document is a credit card invoice
  const isCreditCardInvoice = document?.document_type === 'fatura_cartao'

  // Helper: find category by suggested name
  const findCategoryId = (suggestedCategory: string | null): string => {
    if (!suggestedCategory || categories.length === 0) return ''
    const categoryName = CATEGORY_MAP[suggestedCategory.toLowerCase()] || suggestedCategory
    const found = categories.find(
      (cat: { name: string; type: string }) =>
        cat.name.toLowerCase() === categoryName.toLowerCase() && cat.type === 'expense'
    )
    return found ? String(found.id) : ''
  }

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(file),
    onSuccess: (response) => {
      setUploadError(null)
      const doc = response.data as Document
      setDocument(doc)
      setMode('confirm')

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

      // Auto-detect credit card if this is a credit card invoice
      if (doc.document_type === 'fatura_cartao' && doc.card_info && creditCards.length > 0) {
        const cardInfo = doc.card_info
        // Try to find a matching card
        const matchedCard = creditCards.find((card: { id: number; name: string; last_four_digits?: string }) => {
          // Match by last 4 digits if available
          if (cardInfo.card_last_digits && card.last_four_digits) {
            return card.last_four_digits === cardInfo.card_last_digits
          }
          // Match by issuer name if no digits
          if (cardInfo.card_issuer) {
            return card.name.toLowerCase().includes(cardInfo.card_issuer.toLowerCase())
          }
          return false
        })

        if (matchedCard) {
          setSelectedCreditCardId(String(matchedCard.id))
          setShowCreateCardPrompt(false)
          // Auto-set the account if the card has one
          if ((matchedCard as { account_id?: number }).account_id) {
            setFormData(prev => ({ ...prev, account_id: String((matchedCard as { account_id: number }).account_id) }))
          }
        } else {
          // No matching card found - show prompt to create one
          setShowCreateCardPrompt(true)
        }
      }
    },
    onError: (error: unknown) => {
      setUploadError(getApiErrorMessage(error, 'Erro ao processar documento'))
    },
  })

  // Função para invalidar todos os caches relacionados a transações
  const invalidateTransactionCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
    queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
    queryClient.invalidateQueries({ queryKey: ['budget'] })
    queryClient.invalidateQueries({ queryKey: ['recurring'] })
    queryClient.invalidateQueries({ queryKey: ['invoices'] })
  }

  const confirmMutation = useMutation({
    mutationFn: (data: unknown) => transactionsApi.confirm(data),
    onSuccess: () => {
      invalidateTransactionCaches()
      // Não redirecionar - usuário decide quando sair
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: unknown) => transactionsApi.create(data),
    onSuccess: () => {
      invalidateTransactionCaches()
      // Não redirecionar - usuário decide quando sair
    },
  })

  const createCardMutation = useMutation({
    mutationFn: (cardInfo: {
      card_issuer: string
      card_last_digits?: string
      card_name?: string
      closing_day?: number
      due_day?: number
    }) => invoicesApi.createCardFromInvoice(cardInfo),
    onSuccess: (response) => {
      const data = response.data as { credit_card_id: number; account_id: number; account_name: string }
      // Select the newly created card
      setSelectedCreditCardId(String(data.credit_card_id))
      setFormData(prev => ({ ...prev, account_id: String(data.account_id) }))
      setShowCreateCardPrompt(false)
      setIsCreatingCard(false)
      // Refresh credit cards list
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
    },
    onError: () => {
      setIsCreatingCard(false)
    },
  })

  const batchAddMutation = useMutation({
    mutationFn: async (items: { index: number; data: unknown; description: string; force?: boolean }[]) => {
      const results = []
      const skipped: string[] = []
      const duplicates: { index: number; data: unknown; description: string; message: string }[] = []

      for (const item of items) {
        try {
          // Se force=true, adiciona flag force_duplicate
          const dataToSend = item.force
            ? { ...(item.data as object), force_duplicate: true }
            : item.data
          const result = await transactionsApi.confirm(dataToSend)
          results.push(result)
          setBatchAddSuccess(prev => prev + 1)
        } catch (error: unknown) {
          // Axios error structure
          const axiosError = error as { response?: { status?: number; data?: { detail?: string } }; status?: number }
          const status = axiosError.response?.status || axiosError.status
          const detail = axiosError.response?.data?.detail

          console.log('Batch add error:', { status, detail, error })

          if (status === 409) {
            // Guardar como duplicado pendente para o usuário decidir
            const message = detail || item.description
            duplicates.push({
              index: item.index,
              data: item.data,
              description: item.description,
              message,
            })
          } else {
            // Para outros erros, adicionar como pulado
            const errorMessage = detail || item.description
            skipped.push(`Erro: ${errorMessage}`)
            setBatchAddSkipped(prev => [...prev, `Erro: ${errorMessage}`])
          }
        }
      }

      return { results, skipped, duplicates }
    },
    onSuccess: (data) => {
      // Atualizar lista de duplicados pendentes APÓS a mutação completar
      if (data.duplicates.length > 0) {
        setPendingDuplicates(prev => [...prev, ...data.duplicates])
      }
      invalidateTransactionCaches()
    },
  })

  // Handlers
  const handleFileUpload = (file: File) => {
    uploadMutation.mutate(file)
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
      ownership_type: formData.ownership_type,
      // Campos de recorrência
      create_recurring: formData.create_recurring,
      recurring_frequency: formData.create_recurring ? formData.recurring_frequency : null,
    })
  }

  const toggleItemSelection = (index: number) => {
    setSelectedItems(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const toggleSelectAll = () => {
    if (!document?.extracted_items) return
    if (selectedItems.length === document.extracted_items.length) {
      setSelectedItems([])
    } else {
      // Selecionar todos - usuário decide sobre duplicados
      setSelectedItems(document.extracted_items.map((_, i) => i))
    }
  }

  const handleBatchAdd = () => {
    if (!document?.extracted_items) return
    // For credit card invoices, require credit card selection
    if (isCreditCardInvoice && !selectedCreditCardId) return
    // For other documents, require account selection
    if (!isCreditCardInvoice && !formData.account_id) return

    const itemsToAdd = selectedItems.map(index => {
      const item = document.extracted_items[index]
      return {
        index,
        description: item.description || 'Item',
        data: {
          document_id: document.id,
          amount: Math.abs(item.amount),
          date: item.date || formData.date,
          account_id: parseInt(formData.account_id),
          category_id: findCategoryId(item.category) ? parseInt(findCategoryId(item.category)) : null,
          merchant_name: item.description || null,
          description: item.description || null,
          is_installment: item.is_installment || false,
          installment_current: item.is_installment && item.installment_current ? item.installment_current : null,
          installment_total: item.is_installment && item.installment_total ? item.installment_total : null,
          credit_card_id: selectedCreditCardId ? parseInt(selectedCreditCardId) : null,
          // Invoice period from PDF (so all items go to the same invoice)
          invoice_month: document.card_info?.invoice_month || null,
          invoice_year: document.card_info?.invoice_year || null,
        }
      }
    })

    setBatchAddSuccess(0)
    setBatchAddSkipped([])
    setBatchAddError(null)
    batchAddMutation.mutate(itemsToAdd)
  }

  const handleAddAll = () => {
    if (!document?.extracted_items) return
    // For credit card invoices, require credit card selection
    if (isCreditCardInvoice && !selectedCreditCardId) return
    // For other documents, require account selection
    if (!isCreditCardInvoice && !formData.account_id) return

    // Adicionar todos - usuário decide sobre duplicados
    const itemsToAdd = document.extracted_items.map((item, index) => ({
      index,
      description: item.description || 'Item',
      data: {
        document_id: document.id,
        amount: Math.abs(item.amount),
        date: item.date || formData.date,
        account_id: parseInt(formData.account_id),
        category_id: findCategoryId(item.category) ? parseInt(findCategoryId(item.category)) : null,
        merchant_name: item.description || null,
        description: item.description || null,
        is_installment: item.is_installment || false,
        installment_current: item.is_installment && item.installment_current ? item.installment_current : null,
        installment_total: item.is_installment && item.installment_total ? item.installment_total : null,
        credit_card_id: selectedCreditCardId ? parseInt(selectedCreditCardId) : null,
        // Invoice period from PDF (so all items go to the same invoice)
        invoice_month: document.card_info?.invoice_month || null,
        invoice_year: document.card_info?.invoice_year || null,
      }
    }))

    setSelectedItems(document.extracted_items.map((_, i) => i))
    setBatchAddSuccess(0)
    setBatchAddSkipped([])
    setBatchAddError(null)
    batchAddMutation.mutate(itemsToAdd)
  }

  const handleEditItem = (index: number | null) => {
    setEditingItemIndex(index)
    if (index !== null && document?.extracted_items) {
      const item = document.extracted_items[index]
      setFormData(prev => ({
        ...prev,
        amount: Math.abs(item.amount).toString(),
        date: item.date || prev.date,
        merchant_name: item.description,
        category_id: findCategoryId(item.category),
        is_installment: item.is_installment || false,
        installment_current: item.installment_current?.toString() || '',
        installment_total: item.installment_total?.toString() || '',
      }))
    }
  }

  const handleCreateCard = () => {
    if (!document?.card_info) return

    setIsCreatingCard(true)
    createCardMutation.mutate({
      card_issuer: document.card_info.card_issuer || 'outro',
      card_last_digits: document.card_info.card_last_digits,
      card_name: document.card_info.card_name,
      closing_day: document.card_info.closing_day,
      due_day: document.card_info.due_day,
    })
  }

  // Forçar adição de duplicados pendentes
  const handleForceAddDuplicates = () => {
    if (pendingDuplicates.length === 0) return

    const itemsToForce = pendingDuplicates.map(dup => ({
      index: dup.index,
      data: dup.data,
      description: dup.description,
      force: true,
    }))

    setPendingDuplicates([])
    batchAddMutation.mutate(itemsToForce)
  }

  // Ignorar duplicados pendentes
  const handleSkipDuplicates = () => {
    // Adicionar mensagens aos pulados
    pendingDuplicates.forEach(dup => {
      setBatchAddSkipped(prev => [...prev, dup.message])
    })
    setPendingDuplicates([])
  }

  const resetForm = () => {
    setMode('select')
    setDocument(null)
    setUploadError(null)
    setSelectedItems([])
    setEditingItemIndex(null)
    setBatchAddSuccess(0)
    setBatchAddSkipped([])
    setBatchAddError(null)
    setPendingDuplicates([])
    setFormData(initialFormData)
    setSelectedCreditCardId('')
    setShowCreateCardPrompt(false)
    setIsCreatingCard(false)
  }

  // Render camera mode
  if (mode === 'camera') {
    return (
      <CameraCapture
        onCapture={handleFileUpload}
        onCancel={() => setMode('select')}
        isUploading={uploadMutation.isPending}
        uploadError={uploadError}
      />
    )
  }

  // Render selection screen
  if (mode === 'select') {
    return (
      <UploadSelector
        onCameraClick={() => setMode('camera')}
        onFileSelect={handleFileUpload}
        onManualClick={() => setMode('manual')}
        isUploading={uploadMutation.isPending}
        uploadError={uploadError}
      />
    )
  }

  // Render transaction form (manual or confirmation)
  const isManual = mode === 'manual'
  const isPending = isManual ? createMutation.isPending : confirmMutation.isPending

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isManual ? 'Nova Transação' : 'Confirmar Transação'}
        </h1>
        <button onClick={resetForm} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <X size={24} />
        </button>
      </div>

      <div className="card space-y-4">
        {/* Duplicate alert - informational only */}
        {!isManual && document?.is_duplicate && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 p-3 rounded-lg text-sm">
            <strong>Documento reconhecido:</strong> Este arquivo foi enviado anteriormente. Os dados foram processados novamente e você pode confirmar os itens abaixo.
          </div>
        )}

        {/* Document summary */}
        {!isManual && document && document.status === 'completed' && document.extracted_items && document.extracted_items.length > 0 && (
          <div className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/30 dark:to-blue-900/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                  <CreditCard className="text-primary-600" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {isCreditCardInvoice ? 'Fatura de Cartão' : 'Documento processado'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {document.extracted_items.length} transação(ões) encontrada(s)
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total despesas</p>
                <p className="font-bold text-lg text-gray-900 dark:text-white">
                  R$ {document.extracted_items
                    .filter(item => item.amount > 0)
                    .reduce((sum, item) => sum + item.amount, 0)
                    .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Card info for credit card invoices */}
            {isCreditCardInvoice && document.card_info && (
              <div className="flex items-center gap-2 pt-2 border-t border-primary-100 dark:border-primary-800">
                <CreditCard size={14} className="text-primary-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {document.card_info.card_issuer?.toUpperCase() || 'Cartão'}
                  {document.card_info.card_last_digits && ` ****${document.card_info.card_last_digits}`}
                  {document.card_info.invoice_month && document.card_info.invoice_year && (
                    <span className="ml-1 text-gray-500 dark:text-gray-400">
                      • Ref: {document.card_info.invoice_month.toString().padStart(2, '0')}/{document.card_info.invoice_year}
                    </span>
                  )}
                  {document.card_info.due_date && (
                    <span className="ml-1 text-gray-500 dark:text-gray-400">
                      • Venc: {new Date(document.card_info.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </span>
              </div>
            )}

            {document.extracted_items.some(item => item.is_installment) && (
              <div className="flex items-center gap-2 pt-2 border-t border-primary-100 dark:border-primary-800">
                <Repeat size={14} className="text-blue-600" />
                <span className="text-xs text-blue-700 dark:text-blue-400">
                  {document.extracted_items.filter(item => item.is_installment).length} compra(s) parcelada(s) detectada(s)
                </span>
              </div>
            )}
          </div>
        )}

        {!isManual && document && document.status === 'failed' && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
            <X className="text-red-500" size={18} />
            <span className="text-red-700 dark:text-red-300 text-sm">Falha no processamento do documento</span>
          </div>
        )}

        {!isManual && document && document.status === 'processing' && (
          <div className="flex items-center gap-3 p-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
            <span className="text-gray-600 dark:text-gray-400">Processando documento...</span>
          </div>
        )}

        {/* Extracted items list */}
        {!isManual && document?.extracted_items && document.extracted_items.length > 0 && (
          <ExtractedItemsList
            items={document.extracted_items}
            selectedItems={selectedItems}
            editingItemIndex={editingItemIndex}
            onToggleItem={toggleItemSelection}
            onToggleAll={toggleSelectAll}
            onEditItem={handleEditItem}
            onBatchAdd={handleBatchAdd}
            onAddAll={handleAddAll}
            hasAccount={isCreditCardInvoice ? !!selectedCreditCardId : !!formData.account_id}
            batchAddPending={batchAddMutation.isPending}
            batchAddSuccess={batchAddSuccess}
            batchAddSkipped={batchAddSkipped}
            batchAddError={batchAddError}
            onClearError={() => setBatchAddError(null)}
            pendingDuplicates={pendingDuplicates}
            onForceAddDuplicates={handleForceAddDuplicates}
            onSkipDuplicates={handleSkipDuplicates}
            onNavigateToTransactions={() => navigate('/transactions')}
            onReset={() => {
              setDocument(null)
              setMode('select')
              setBatchAddSuccess(0)
              setBatchAddSkipped([])
              setBatchAddError(null)
              setPendingDuplicates([])
              setSelectedItems([])
              setEditingItemIndex(null)
              setSelectedCreditCardId('')
            }}
          />
        )}

        {/* Credit card selector - shown for credit card invoices */}
        {(!isManual && isCreditCardInvoice && document?.extracted_items && document.extracted_items.length > 0 && editingItemIndex === null) && (
          <div className="space-y-3">
            {/* Card creation prompt */}
            {showCreateCardPrompt && document.card_info && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="font-medium text-amber-800 dark:text-amber-300">
                      Cartão não cadastrado
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                      Detectamos uma fatura do{' '}
                      <strong>{document.card_info.card_issuer?.toUpperCase() || 'cartão'}</strong>
                      {document.card_info.card_last_digits && ` final ${document.card_info.card_last_digits}`}.
                      Deseja cadastrar este cartão automaticamente?
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleCreateCard}
                        disabled={isCreatingCard}
                        className="btn-primary text-sm flex items-center gap-2"
                      >
                        <Plus size={16} />
                        {isCreatingCard ? 'Criando...' : 'Criar Cartão'}
                      </button>
                      <button
                        onClick={() => setShowCreateCardPrompt(false)}
                        className="btn-secondary text-sm"
                      >
                        Selecionar Manualmente
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cartão de Crédito *
              </label>
              <select
                value={selectedCreditCardId}
                onChange={(e) => {
                  setSelectedCreditCardId(e.target.value)
                  setShowCreateCardPrompt(false)
                  // Auto-select the card's linked account
                  const card = creditCards.find((c: { id: number }) => c.id === parseInt(e.target.value))
                  if (card?.account_id) {
                    setFormData(prev => ({ ...prev, account_id: String(card.account_id) }))
                  }
                }}
                className="input"
              >
                <option value="">Selecione o cartão</option>
                {creditCards.map((card: { id: number; name: string }) => (
                  <option key={card.id} value={card.id}>{card.name}</option>
                ))}
              </select>
              {creditCards.length === 0 && !showCreateCardPrompt && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Nenhum cartão cadastrado.{' '}
                  <button
                    onClick={() => setShowCreateCardPrompt(true)}
                    className="text-primary-600 hover:underline"
                  >
                    Criar um cartão
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Account selector - shown for batch operations only when NOT editing an item */}
        {(!isManual && document?.extracted_items && document.extracted_items.length > 0 && editingItemIndex === null && !isCreditCardInvoice) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Conta *</label>
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
          </div>
        )}

        {/* Full form for manual mode or single item edit */}
        {(isManual || editingItemIndex !== null) && (
          <TransactionForm
            formData={formData}
            onChange={(data) => setFormData(prev => ({ ...prev, ...data }))}
            accounts={accounts}
            categories={categories}
            onSubmit={isManual ? handleManualSubmit : handleConfirm}
            isPending={isPending}
            isManual={isManual}
            showOwnershipSelector={!!showOwnershipSelector}
            showInstallmentSection={!isManual}
            editingItemDescription={editingItemIndex !== null && document?.extracted_items ? document.extracted_items[editingItemIndex]?.description : undefined}
            onCloseEdit={() => setEditingItemIndex(null)}
          />
        )}
      </div>
    </div>
  )
}
