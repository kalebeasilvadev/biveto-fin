import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentsApi, transactionsApi, accountsApi, categoriesApi, familyApi, creditCardsApi, invoicesApi, recurringApi, getApiErrorMessage } from '../services/api'
import { X, CreditCard, Repeat, Plus, AlertCircle, Check } from 'lucide-react'
import {
  Document,
  TransactionFormData,
  UploadMode,
  CATEGORY_MAP,
  initialFormData,
  ExtractedItem,
} from '../types/upload'
import {
  CameraCapture,
  UploadSelector,
  ExtractedItemsList,
  TransactionForm,
} from '../components/upload'
import OwnershipSelector from '../components/shared/OwnershipSelector'

const accountTypeLabels: Record<string, string> = {
  wallet: 'Carteira',
  bank: 'Banco',
  credit_card: 'Cartão',
  investment: 'Investimento',
}

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
  // Ownership type for batch operations
  const [batchOwnershipType, setBatchOwnershipType] = useState<'personal' | 'household'>('household')

  // Credit card invoice state
  const [selectedCreditCardId, setSelectedCreditCardId] = useState<string>('')
  const [showCreateCardPrompt, setShowCreateCardPrompt] = useState(false)
  const [isCreatingCard, setIsCreatingCard] = useState(false)

  // Parcelas projetadas state
  const [projectedInfo, setProjectedInfo] = useState<Record<number, {
    has_projected: boolean
    projected_transaction_id?: number
    projected_date?: string
    series_id?: number
    series_description?: string
    message?: string
  }>>({})
  const [isCheckingProjected, setIsCheckingProjected] = useState(false)

  // Recurring creation state
  const [creatingRecurringIndex, setCreatingRecurringIndex] = useState<number | null>(null)

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

  // Criar mapa de account_id -> credit_card_id para vincular transacoes a faturas
  const accountToCreditCardMap = new Map<number, number>()
  creditCards.forEach((card: { account_id: number; id: number }) => {
    if (card.account_id) {
      accountToCreditCardMap.set(card.account_id, card.id)
    }
  })

  // Check if document is a credit card invoice
  const isCreditCardInvoice = document?.document_type === 'fatura_cartao'

  // Verificar parcelas projetadas quando documento é carregado
  useEffect(() => {
    const checkProjected = async () => {
      if (!document?.extracted_items || document.extracted_items.length === 0) return
      if (!isCreditCardInvoice) return

      // Só verificar itens parcelados
      const installmentItems = document.extracted_items
        .map((item, index) => ({ ...item, index }))
        .filter(item => item.is_installment && item.installment_current && item.installment_total)

      if (installmentItems.length === 0) return

      setIsCheckingProjected(true)
      try {
        const response = await transactionsApi.checkProjected({
          items: installmentItems.map(item => ({
            index: item.index,
            description: item.description || '',
            amount: Math.abs(item.amount),
            date: item.date || undefined,
            is_installment: item.is_installment || undefined,
            installment_current: item.installment_current || undefined,
            installment_total: item.installment_total || undefined,
          })),
          credit_card_id: selectedCreditCardId ? parseInt(selectedCreditCardId) : undefined,
          invoice_month: document.card_info?.invoice_month,
          invoice_year: document.card_info?.invoice_year,
        })

        const results = response.data.results as Array<{
          index: number
          has_projected: boolean
          projected_transaction_id?: number
          projected_date?: string
          series_id?: number
          series_description?: string
          message?: string
        }>

        const projectedMap: Record<number, typeof results[0]> = {}
        results.forEach(result => {
          projectedMap[result.index] = result
        })
        setProjectedInfo(projectedMap)
      } catch (error) {
        console.error('Erro ao verificar parcelas projetadas:', error)
      } finally {
        setIsCheckingProjected(false)
      }
    }

    checkProjected()
  }, [document, selectedCreditCardId, isCreditCardInvoice])

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

        // Helper function to normalize strings for comparison
        const normalize = (str: string) => str.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
          .replace(/[_-]/g, ' ') // Replace underscores/dashes with spaces
          .trim()

        // Issuer variants map - maps issuer names to related terms
        const issuerVariants: Record<string, string[]> = {
          'bradescard': ['bradesco', 'bradescard', 'amazon'],
          'bradesco': ['bradesco', 'bradescard'],
          'itau': ['itau', 'itaucard'],
          'nubank': ['nubank', 'nu'],
          'santander': ['santander'],
          'inter': ['inter', 'banco inter'],
          'c6': ['c6', 'c6 bank'],
          'bb': ['banco do brasil', 'bb'],
          'caixa': ['caixa', 'cef'],
          'amazon': ['amazon', 'bradesco', 'bradescard'],
          'carrefour': ['carrefour'],
          'digio': ['digio'],
          'pagbank': ['pagbank', 'pagseguro'],
          'picpay': ['picpay'],
          'mercadopago': ['mercado pago', 'mercadopago'],
        }

        // Get variants for an issuer
        const getIssuerVariants = (issuer: string): string[] => {
          const normalized = normalize(issuer)
          for (const [key, variants] of Object.entries(issuerVariants)) {
            if (normalized.includes(key) || key.includes(normalized)) {
              return [...variants, normalized]
            }
          }
          // Return the issuer itself and its words
          return [normalized, ...normalized.split(/\s+/).filter(w => w.length > 2)]
        }

        // Helper function to check if two strings match (fuzzy)
        const fuzzyMatch = (str1: string, str2: string): boolean => {
          const s1 = normalize(str1)
          const s2 = normalize(str2)

          // Direct includes check both directions
          if (s1.includes(s2) || s2.includes(s1)) return true

          // Word-by-word matching: check if any significant word matches
          const words1 = s1.split(/\s+/).filter(w => w.length > 2)
          const words2 = s2.split(/\s+/).filter(w => w.length > 2)

          // Check if any word from one exists in the other
          for (const w1 of words1) {
            for (const w2 of words2) {
              if (w1.includes(w2) || w2.includes(w1)) return true
            }
          }

          return false
        }

        // Try to find a matching card with scoring
        let bestMatch: { card: typeof creditCards[0]; score: number } | null = null

        for (const card of creditCards as Array<{ id: number; name: string; last_four_digits?: string }>) {
          let score = 0
          const cardNameNormalized = normalize(card.name)

          // Match by last 4 digits (highest priority)
          if (cardInfo.card_last_digits && card.last_four_digits) {
            if (card.last_four_digits === cardInfo.card_last_digits) {
              score += 100 // Strong match
            }
          }

          // Match by card name (from PDF) vs registered card name
          if (cardInfo.card_name && fuzzyMatch(card.name, cardInfo.card_name)) {
            score += 50
          }

          // Match by partner (amazon, smiles, etc.) - high value because it's specific
          if (cardInfo.card_partner && cardNameNormalized.includes(normalize(cardInfo.card_partner))) {
            score += 40
          }

          // Match by bank name
          if (cardInfo.card_bank && fuzzyMatch(card.name, cardInfo.card_bank)) {
            score += 25
          }

          // Match by issuer name using variants
          if (cardInfo.card_issuer) {
            const variants = getIssuerVariants(cardInfo.card_issuer)
            for (const variant of variants) {
              if (cardNameNormalized.includes(variant) || variant.includes(cardNameNormalized)) {
                score += 30
                break
              }
            }
            // Also try fuzzy match if no variant matched
            if (score < 55 && fuzzyMatch(card.name, cardInfo.card_issuer)) {
              score += 30
            }
          }

          // Match by brand (visa, mastercard) - lower priority
          if (cardInfo.card_brand && cardNameNormalized.includes(normalize(cardInfo.card_brand))) {
            score += 10
          }

          // Update best match
          if (score > 0 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { card, score }
          }
        }

        const matchedCard = bestMatch?.card

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

  const [createSuccess, setCreateSuccess] = useState<{
    isInstallment: boolean
    installmentCurrent?: number
    installmentTotal?: number
    amount: number
  } | null>(null)

  const createMutation = useMutation({
    mutationFn: (data: unknown) => transactionsApi.create(data),
    onSuccess: (_response, variables) => {
      invalidateTransactionCaches()
      const vars = variables as {
        is_installment?: boolean
        installment_current?: number
        installment_total?: number
        amount: number
      }
      // Mostrar mensagem de sucesso
      setCreateSuccess({
        isInstallment: vars.is_installment || false,
        installmentCurrent: vars.installment_current,
        installmentTotal: vars.installment_total,
        amount: vars.amount,
      })
      // Resetar formulário
      setFormData(initialFormData)
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

  const createRecurringMutation = useMutation({
    mutationFn: (data: {
      name: string
      amount: number
      account_id: number
      frequency?: string
      day_of_month?: number
      category_name?: string
      payment_method?: string
      credit_card_id?: number
    }) => recurringApi.createFromSuggestion(data),
    onSuccess: () => {
      setCreatingRecurringIndex(null)
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
      // Update the document to mark this item as user_recurring
      if (document && creatingRecurringIndex !== null) {
        const updatedItems = [...document.extracted_items]
        if (updatedItems[creatingRecurringIndex]?.recurring_detection) {
          updatedItems[creatingRecurringIndex] = {
            ...updatedItems[creatingRecurringIndex],
            recurring_detection: {
              ...updatedItems[creatingRecurringIndex].recurring_detection!,
              is_user_recurring: true,
            }
          }
          setDocument({ ...document, extracted_items: updatedItems })
        }
      }
    },
    onError: () => {
      setCreatingRecurringIndex(null)
    },
  })

  // Batch create recurring mutation
  const [isCreatingAllRecurrences, setIsCreatingAllRecurrences] = useState(false)
  const batchCreateRecurringMutation = useMutation({
    mutationFn: (items: Array<{
      name: string
      amount: number
      account_id: number
      frequency?: string
      day_of_month?: number
      category_name?: string
      payment_method?: string
      credit_card_id?: number
    }>) => recurringApi.batchCreateFromSuggestion(items),
    onSuccess: (response) => {
      setIsCreatingAllRecurrences(false)
      queryClient.invalidateQueries({ queryKey: ['recurring'] })

      const result = response.data as {
        total: number
        success_count: number
        duplicate_count: number
        error_count: number
        results: Array<{ index: number; success: boolean; recurring_name?: string; is_duplicate?: boolean }>
      }

      // Update document to mark all created items as user_recurring
      if (document) {
        const updatedItems = [...document.extracted_items]
        const detectedIndices = updatedItems
          .map((item, idx) => ({ item, idx }))
          .filter(({ item }) =>
            item.recurring_detection?.is_known_service &&
            !item.recurring_detection?.is_user_recurring &&
            item.recurring_detection?.suggested_recurring
          )

        result.results.forEach((res, i) => {
          if (res.success && detectedIndices[i]) {
            const { idx } = detectedIndices[i]
            if (updatedItems[idx]?.recurring_detection) {
              updatedItems[idx] = {
                ...updatedItems[idx],
                recurring_detection: {
                  ...updatedItems[idx].recurring_detection!,
                  is_user_recurring: true,
                }
              }
            }
          }
        })

        setDocument({ ...document, extracted_items: updatedItems })
      }

      // Show success message
      if (result.success_count > 0) {
        setBatchAddError(null)
      }
      if (result.duplicate_count > 0 || result.error_count > 0) {
        const messages = []
        if (result.success_count > 0) messages.push(`${result.success_count} recorrência(s) criada(s)`)
        if (result.duplicate_count > 0) messages.push(`${result.duplicate_count} já existia(m)`)
        if (result.error_count > 0) messages.push(`${result.error_count} erro(s)`)
        // No error - just info
      }
    },
    onError: (error) => {
      setIsCreatingAllRecurrences(false)
      setBatchAddError('Erro ao criar recorrências: ' + (error as Error).message)
    },
  })

  const batchAddMutation = useMutation({
    mutationFn: async (items: { index: number; data: unknown; description: string; force?: boolean }[]) => {
      // Preparar items para o batch endpoint
      const batchItems = items.map(item => {
        const dataObj = item.data as Record<string, unknown>
        return {
          ...dataObj,
          force_duplicate: item.force || false,
        }
      })

      // Extrair closing_day e due_day do card_info do documento (para atualizar o cartao automaticamente)
      const cardClosingDay = document?.card_info?.closing_day
      const cardDueDay = document?.card_info?.due_day

      // Chamar o endpoint de batch (uma única requisição)
      const response = await transactionsApi.batchConfirm({
        items: batchItems,
        card_closing_day: cardClosingDay,
        card_due_day: cardDueDay,
      })
      const batchResult = response.data as {
        total: number
        success_count: number
        duplicate_count: number
        error_count: number
        results: Array<{
          index: number
          success: boolean
          transaction_id?: number
          error?: string
          is_duplicate: boolean
        }>
      }

      // Processar resultados
      const duplicates: { index: number; data: unknown; description: string; message: string }[] = []
      const skipped: string[] = []

      batchResult.results.forEach((result, idx) => {
        const originalItem = items[idx]
        if (result.success) {
          setBatchAddSuccess(prev => prev + 1)
        } else if (result.is_duplicate) {
          duplicates.push({
            index: originalItem.index,
            data: originalItem.data,
            description: originalItem.description,
            message: result.error || originalItem.description,
          })
        } else {
          const errorMessage = result.error || originalItem.description
          skipped.push(`Erro: ${errorMessage}`)
          setBatchAddSkipped(prev => [...prev, `Erro: ${errorMessage}`])
        }
      })

      return { results: batchResult.results, skipped, duplicates }
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

  const handleManualSubmit = () => {
    const accountId = parseInt(formData.account_id)
    // Verificar se a conta é de cartão de crédito e obter o credit_card_id
    const creditCardId = accountToCreditCardMap.get(accountId) || null

    createMutation.mutate({
      type: formData.type,
      amount: parseFloat(formData.amount),
      date: formData.date,
      account_id: accountId,
      category_id: formData.category_id ? parseInt(formData.category_id) : null,
      merchant_name: formData.merchant_name || null,
      description: formData.description || null,
      ownership_type: formData.ownership_type,
      // Vincula ao cartão de crédito se a conta for de cartão
      credit_card_id: creditCardId,
      // Campos de parcelamento
      is_installment: formData.is_installment,
      installment_current: formData.is_installment && formData.installment_current ? parseInt(formData.installment_current) : null,
      installment_total: formData.is_installment && formData.installment_total ? parseInt(formData.installment_total) : null,
      // Criar parcelas futuras automaticamente se for parcelamento
      create_future_installments: formData.is_installment &&
        formData.installment_current &&
        formData.installment_total &&
        parseInt(formData.installment_current) < parseInt(formData.installment_total),
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
          ownership_type: batchOwnershipType,
          is_installment: item.is_installment || false,
          installment_current: item.is_installment && item.installment_current ? item.installment_current : null,
          installment_total: item.is_installment && item.installment_total ? item.installment_total : null,
          credit_card_id: selectedCreditCardId ? parseInt(selectedCreditCardId) : null,
          // Invoice period from PDF (so all items go to the same invoice)
          invoice_month: document.card_info?.invoice_month || null,
          invoice_year: document.card_info?.invoice_year || null,
          // Criar parcelas futuras automaticamente para itens parcelados
          create_future_installments: item.is_installment &&
            item.installment_current &&
            item.installment_total &&
            item.installment_current < item.installment_total,
          // Tipo de transacao extraido pelo LLM (pagamento, credito, estorno, compra, etc)
          extracted_transaction_type: item.transaction_type || null,
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
        ownership_type: batchOwnershipType,
        is_installment: item.is_installment || false,
        installment_current: item.is_installment && item.installment_current ? item.installment_current : null,
        installment_total: item.is_installment && item.installment_total ? item.installment_total : null,
        credit_card_id: selectedCreditCardId ? parseInt(selectedCreditCardId) : null,
        // Invoice period from PDF (so all items go to the same invoice)
        invoice_month: document.card_info?.invoice_month || null,
        invoice_year: document.card_info?.invoice_year || null,
        // Criar parcelas futuras automaticamente para itens parcelados
        create_future_installments: item.is_installment &&
          item.installment_current &&
          item.installment_total &&
          item.installment_current < item.installment_total,
        // Tipo de transacao extraido pelo LLM (pagamento, credito, estorno, compra, etc)
        extracted_transaction_type: item.transaction_type || null,
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

  // Handler para atualizar item inline
  const handleUpdateItem = (index: number, updatedFields: Partial<ExtractedItem>) => {
    if (!document?.extracted_items) return

    const updatedItems = [...document.extracted_items]
    updatedItems[index] = {
      ...updatedItems[index],
      ...updatedFields,
    }

    setDocument({
      ...document,
      extracted_items: updatedItems,
    })
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

  // Create recurring from detected service
  const handleCreateRecurring = (index: number) => {
    if (!document?.extracted_items) return
    const item = document.extracted_items[index]
    if (!item.recurring_detection?.suggested_recurring) return

    // Para faturas de cartão, obter account_id do cartão selecionado
    let accountId: number | null = null
    let creditCardId: number | null = null

    if (isCreditCardInvoice) {
      if (!selectedCreditCardId) {
        setBatchAddError('Selecione um cartão de crédito antes de criar a recorrência')
        return
      }
      creditCardId = parseInt(selectedCreditCardId)
      // Obter account_id do cartão
      const selectedCard = creditCards.find((c: { id: number; account_id?: number }) => c.id === creditCardId)
      accountId = selectedCard?.account_id || null
      if (!accountId) {
        setBatchAddError('O cartão selecionado não possui uma conta vinculada')
        return
      }
    } else {
      accountId = formData.account_id ? parseInt(formData.account_id) : null
      if (!accountId) {
        setBatchAddError('Selecione uma conta antes de criar a recorrência')
        return
      }
    }

    setCreatingRecurringIndex(index)
    const suggestion = item.recurring_detection.suggested_recurring

    // Extract day from the item date if available
    let dayOfMonth = suggestion.day_of_month
    if (!dayOfMonth && item.date) {
      dayOfMonth = new Date(item.date + 'T12:00:00').getDate()
    }

    createRecurringMutation.mutate({
      name: suggestion.name,
      amount: suggestion.amount,
      account_id: accountId,
      frequency: suggestion.frequency || 'monthly',
      day_of_month: dayOfMonth,
      category_name: suggestion.default_category || item.category || undefined,
      payment_method: isCreditCardInvoice ? 'credit_card' : 'debit',
      credit_card_id: creditCardId || undefined,
    })
  }

  // Create all detected recurring services at once
  const handleCreateAllRecurrences = () => {
    if (!document?.extracted_items) return

    // Para faturas de cartão, obter account_id do cartão selecionado
    let accountId: number | null = null
    let creditCardId: number | null = null

    if (isCreditCardInvoice) {
      if (!selectedCreditCardId) {
        setBatchAddError('Selecione um cartão de crédito antes de criar as recorrências')
        return
      }
      creditCardId = parseInt(selectedCreditCardId)
      const selectedCard = creditCards.find((c: { id: number; account_id?: number }) => c.id === creditCardId)
      accountId = selectedCard?.account_id || null
      if (!accountId) {
        setBatchAddError('O cartão selecionado não possui uma conta vinculada')
        return
      }
    } else {
      accountId = formData.account_id ? parseInt(formData.account_id) : null
      if (!accountId) {
        setBatchAddError('Selecione uma conta antes de criar as recorrências')
        return
      }
    }

    // Filter items that have detected recurring services not yet registered
    const itemsToCreate = document.extracted_items
      .filter(item =>
        item.recurring_detection?.is_known_service &&
        !item.recurring_detection?.is_user_recurring &&
        item.recurring_detection?.suggested_recurring
      )
      .map(item => {
        const suggestion = item.recurring_detection!.suggested_recurring!
        let dayOfMonth = suggestion.day_of_month
        if (!dayOfMonth && item.date) {
          dayOfMonth = new Date(item.date + 'T12:00:00').getDate()
        }
        return {
          name: suggestion.name,
          amount: suggestion.amount,
          account_id: accountId!,
          frequency: suggestion.frequency || 'monthly',
          day_of_month: dayOfMonth,
          category_name: suggestion.default_category || item.category || undefined,
          payment_method: isCreditCardInvoice ? 'credit_card' : 'debit',
          credit_card_id: creditCardId || undefined,
        }
      })

    if (itemsToCreate.length === 0) {
      setBatchAddError('Nenhuma recorrência para criar')
      return
    }

    setIsCreatingAllRecurrences(true)
    batchCreateRecurringMutation.mutate(itemsToCreate)
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
    setCreatingRecurringIndex(null)
    setCreateSuccess(null)
    setBatchOwnershipType('household')
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
        {!isManual && document && document.status === 'completed' && document.extracted_items && document.extracted_items.length > 0 && (() => {
          const totalDespesas = document.extracted_items
            .filter(item => item.amount > 0)
            .reduce((sum, item) => sum + item.amount, 0)
          const totalEstornos = document.extracted_items
            .filter(item => item.amount < 0 && item.category !== 'pagamento')
            .reduce((sum, item) => sum + item.amount, 0)
          const totalPagamentos = document.extracted_items
            .filter(item => item.category === 'pagamento')
            .reduce((sum, item) => sum + item.amount, 0)
          const totalFatura = isCreditCardInvoice && document.card_info?.total_amount
            ? document.card_info.total_amount
            : totalDespesas + totalEstornos

          return (
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
              </div>

              {/* Mini cards com totais */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center shadow-sm">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Despesas</p>
                  <p className="font-bold text-sm text-gray-900 dark:text-white">
                    R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {totalEstornos < 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center shadow-sm">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Estornos</p>
                    <p className="font-bold text-sm text-green-600">
                      R$ {totalEstornos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center shadow-sm">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {isCreditCardInvoice ? 'Total Fatura' : 'Total'}
                  </p>
                  <p className="font-bold text-sm text-primary-600">
                    R$ {totalFatura.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Pagamentos registrados */}
              {totalPagamentos < 0 && (
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-green-600 dark:text-green-400 uppercase tracking-wide">Pagamento registrado</p>
                  <p className="font-bold text-sm text-green-700 dark:text-green-300">
                    R$ {Math.abs(totalPagamentos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}

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
          )
        })()}

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

        {/* Ownership selector - shown when family has multiple members and not editing an item */}
        {(!isManual && document?.extracted_items && document.extracted_items.length > 0 && editingItemIndex === null && showOwnershipSelector) && (
          <OwnershipSelector
            value={batchOwnershipType}
            onChange={setBatchOwnershipType}
            description="Define se as transações serão pessoais ou compartilhadas com a família"
          />
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
            onUpdateItem={handleUpdateItem}
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
              setProjectedInfo({})
              setCreatingRecurringIndex(null)
              setBatchOwnershipType('household')
            }}
            projectedInfo={projectedInfo}
            isCheckingProjected={isCheckingProjected}
            onCreateRecurring={handleCreateRecurring}
            creatingRecurringIndex={creatingRecurringIndex}
            onCreateAllRecurrences={handleCreateAllRecurrences}
            isCreatingAllRecurrences={isCreatingAllRecurrences}
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
              {accounts.map((acc: { id: number; name: string; type: 'wallet' | 'bank' | 'credit_card' | 'investment' }) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({accountTypeLabels[acc.type]})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Success message for manual transactions */}
        {isManual && createSuccess && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full">
                <Check className="text-green-600" size={20} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-green-800 dark:text-green-300">
                  Transação criada com sucesso!
                </p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  {createSuccess.isInstallment && createSuccess.installmentCurrent && createSuccess.installmentTotal ? (
                    <>
                      Parcela {createSuccess.installmentCurrent}/{createSuccess.installmentTotal} de{' '}
                      {createSuccess.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      {createSuccess.installmentCurrent < createSuccess.installmentTotal && (
                        <> • As próximas parcelas serão criadas automaticamente</>
                      )}
                    </>
                  ) : (
                    <>
                      Valor: {createSuccess.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </>
                  )}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setCreateSuccess(null)}
                    className="text-sm text-green-700 dark:text-green-300 hover:underline"
                  >
                    Criar outra transação
                  </button>
                  <span className="text-green-700 dark:text-green-300">•</span>
                  <button
                    onClick={() => navigate('/transactions')}
                    className="text-sm text-green-700 dark:text-green-300 hover:underline"
                  >
                    Ver transações
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full form for manual mode only */}
        {isManual && !createSuccess && (
          <TransactionForm
            formData={formData}
            onChange={(data) => setFormData(prev => ({ ...prev, ...data }))}
            accounts={accounts}
            categories={categories}
            onSubmit={handleManualSubmit}
            isPending={isPending}
            isManual={true}
            showOwnershipSelector={!!showOwnershipSelector}
            showInstallmentSection={true}
          />
        )}
      </div>
    </div>
  )
}
