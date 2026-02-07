import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentsApi, transactionsApi, accountsApi, categoriesApi, familyApi, creditCardsApi, invoicesApi, recurringApi, benefitCardsApi, receiptsApi, getApiErrorMessage } from '../services/api'
import { useUploadStore } from '../stores/uploadStore'
import { X, CreditCard, Repeat, Plus, AlertCircle, Check, Wallet } from 'lucide-react'
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
import DuplicateResolutionModal from '../components/upload/DuplicateResolutionModal'
import OwnershipSelector from '../components/shared/OwnershipSelector'
import { HelpButton } from '../components/help'
import PasswordInputModal from '../components/PasswordInputModal'

const accountTypeLabels: Record<string, string> = {
  wallet: 'Carteira',
  bank: 'Banco',
  credit_card: 'Cartão',
  investment: 'Investimento',
}

export default function Upload() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  // Pending file from FAB
  const pendingFile = useUploadStore((state) => state.pendingFile)
  const clearPendingFile = useUploadStore((state) => state.clearPendingFile)
  const pendingFileProcessed = useRef(false)

  // Initialize mode from URL parameter and track if came directly from URL
  const initialMode = searchParams.get('mode') === 'manual' ? 'manual' : 'select'
  const [cameFromUrl] = useState(() => searchParams.get('mode') === 'manual')
  const [mode, setMode] = useState<UploadMode>(initialMode)

  // Clear URL parameter when mode changes away from manual
  useEffect(() => {
    if (mode !== 'manual' && searchParams.get('mode') === 'manual') {
      setSearchParams({}, { replace: true })
    }
  }, [mode, searchParams, setSearchParams])

  // Process pending file from FAB on mount
  useEffect(() => {
    if (pendingFile && !pendingFileProcessed.current) {
      pendingFileProcessed.current = true
      // Clear the pending file from store
      clearPendingFile()
      // Trigger upload
      handleFileUpload(pendingFile)
    }
  }, [pendingFile]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Invoice reference state (editable month/year)
  const [invoiceReference, setInvoiceReference] = useState<{ month: number | null; year: number | null }>({
    month: null,
    year: null
  })

  // Payment mapping state for receipts with split payments
  // Maps payment index to { account_id, benefit_card_id, installment data }
  const [paymentMappings, setPaymentMappings] = useState<Record<number, {
    account_id: string
    benefit_card_id: string
    is_installment: boolean
    installment_count: number
    credit_card_id: string
  }>>({})
  const [receiptConfirmError, setReceiptConfirmError] = useState<string | null>(null)

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

  // Duplicatas potenciais state
  const [potentialDuplicates, setPotentialDuplicates] = useState<Record<number, {
    series_id: number
    description: string
    merchant_name: string
    installment_count: number
    installment_amount: number
    paid_count: number
    similarity_score: number
    first_installment_date: string
  }>>({})
  const [duplicateModalIndex, setDuplicateModalIndex] = useState<number | null>(null)

  // Recurring creation state
  const [creatingRecurringIndex, setCreatingRecurringIndex] = useState<number | null>(null)

  // State for async upload polling
  const [processingDocumentId, setProcessingDocumentId] = useState<number | null>(null)

  // Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [pendingPasswordFile, setPendingPasswordFile] = useState<File | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordAttemptCount, setPasswordAttemptCount] = useState(0)
  const [passwordCreditCardId, setPasswordCreditCardId] = useState<number | undefined>(undefined)

  // Debug: Monitor showPasswordModal changes
  useEffect(() => {
    console.log('[Upload] showPasswordModal changed to:', showPasswordModal)
  }, [showPasswordModal])

  // Poll for document status when processing
  const { data: polledDocument } = useQuery({
    queryKey: ['document', processingDocumentId],
    queryFn: () => documentsApi.get(processingDocumentId!),
    enabled: !!processingDocumentId,
    refetchInterval: (query) => {
      const doc = query.state.data?.data as Document | undefined
      // Poll every 2 seconds while processing, stop when completed or failed
      return doc?.status === 'processing' ? 2000 : false
    },
  })

  // Handle polling result
  useEffect(() => {
    if (!polledDocument?.data) return
    const doc = polledDocument.data as Document
    if (doc.status === 'completed' || doc.status === 'failed') {
      setProcessingDocumentId(null)
      handleUploadSuccess({ data: doc })
    }
  }, [polledDocument])

  // Prevent accidental page reload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (document || mode === 'confirm' || processingDocumentId) {
        e.preventDefault()
        e.returnValue = 'Você tem dados não salvos. Deseja realmente sair?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [document, mode, processingDocumentId])

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

  const { data: benefitCardsData } = useQuery({
    queryKey: ['benefit-cards'],
    queryFn: benefitCardsApi.list,
  })

  const accounts = accountsData?.data || []
  const benefitCards = benefitCardsData?.data || []
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

  // Check if document is a cupom fiscal with split payments
  const isCupomFiscalWithSplitPayment = document?.document_type === 'cupom_fiscal' &&
    document?.payment_info?.payments &&
    document.payment_info.payments.length > 0

  // Check if all payments are mapped to accounts (and installment payments have credit card)
  const allPaymentsMapped = !isCupomFiscalWithSplitPayment ||
    (document?.payment_info?.payments?.every((_p, idx) => {
      const mapping = paymentMappings[idx]
      if (!mapping?.account_id && !mapping?.is_installment) return false
      // If it's an installment payment, must have credit_card_id
      if (mapping?.is_installment && !mapping?.credit_card_id) return false
      return true
    }) ?? false)

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
          invoice_month: invoiceReference.month || undefined,
          invoice_year: invoiceReference.year || undefined,
        })

        const results = response.data.results as Array<{
          index: number
          has_projected: boolean
          projected_transaction_id?: number
          projected_date?: string
          series_id?: number
          series_description?: string
          message?: string
          potential_duplicate_series?: {
            series_id: number
            description: string
            merchant_name: string
            installment_count: number
            installment_amount: number
            paid_count: number
            similarity_score: number
            first_installment_date: string
          }
        }>

        const projectedMap: Record<number, typeof results[0]> = {}
        const duplicatesMap: Record<number, NonNullable<typeof results[0]['potential_duplicate_series']>> = {}

        results.forEach(result => {
          projectedMap[result.index] = result

          // Extrair duplicatas potenciais
          if (result.potential_duplicate_series) {
            duplicatesMap[result.index] = result.potential_duplicate_series
          }
        })

        setProjectedInfo(projectedMap)
        setPotentialDuplicates(duplicatesMap)
      } catch (error) {
        console.error('Erro ao verificar parcelas projetadas:', error)
      } finally {
        setIsCheckingProjected(false)
      }
    }

    checkProjected()
  }, [document, selectedCreditCardId, isCreditCardInvoice, invoiceReference])

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
    mutationFn: ({ file, password, creditCardId }: { file: File; password?: string; creditCardId?: number }) =>
      documentsApi.upload(file, password, creditCardId),
    onSuccess: handleUploadSuccess,
    onError: (error: unknown) => {
      // Debug: log error structure
      console.log('=== UPLOAD ERROR DEBUG ===')
      console.log('Full error:', error)

      // Check for password required error
      const axiosErr = error as { response?: { status?: number; data?: { detail?: { error?: string; message?: string } | string } } }

      console.log('Status code:', axiosErr.response?.status)
      console.log('Response data:', axiosErr.response?.data)
      console.log('Detail:', axiosErr.response?.data?.detail)
      console.log('Detail type:', typeof axiosErr.response?.data?.detail)

      // Handle object detail format
      if (axiosErr.response?.status === 422) {
        const detail = axiosErr.response?.data?.detail

        console.log('Processing 422 error, detail:', detail)

        // Check if detail is an object with error property
        if (detail && typeof detail === 'object' && 'error' in detail && detail.error === 'password_required') {
          console.log('✅ PASSWORD REQUIRED - SHOWING MODAL')
          console.log('Setting showPasswordModal to true')
          setPasswordError(null)
          setPasswordAttemptCount(0)
          setShowPasswordModal(true)
          console.log('Modal should be visible now')
          return
        } else {
          console.log('❌ Detail does not match password_required format')
          console.log('Detail structure:', JSON.stringify(detail, null, 2))
        }
      }

      // Check for incorrect password
      if (axiosErr.response?.status === 422) {
        const detail = axiosErr.response?.data?.detail
        const message = detail && typeof detail === 'object' && 'message' in detail ? detail.message : ''
        if (message && typeof message === 'string' && message.includes('Senha incorreta')) {
          setPasswordError('Senha incorreta. Verifique e tente novamente.')
          setPasswordAttemptCount(prev => prev + 1)
          return
        }
      }

      setUploadError(getApiErrorMessage(error, 'Erro ao processar documento'))
    },
  })

  function handleUploadSuccess(response: { data: Document }) {
      setUploadError(null)
      const doc = response.data as Document
      setDocument(doc)
      setMode('confirm')

      // Initialize invoice reference from OCR extraction
      if (doc.card_info) {
        setInvoiceReference({
          month: doc.card_info.invoice_month || null,
          year: doc.card_info.invoice_year || null
        })
      }

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
  }

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
      start_date?: string
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
      start_date?: string
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

  // Receipt confirmation mutation (for cupom fiscal with split payments)
  const receiptConfirmMutation = useMutation({
    mutationFn: async (data: {
      document_id: number
      store_name: string
      store_cnpj?: string
      purchase_date: string
      total_amount: number
      subtotal?: number
      discount?: number
      items: Array<{
        description: string
        amount: number
        category_id?: number
        quantity?: number
        unit?: string
        unit_price?: number
      }>
      payments: Array<{
        payment_method: string
        amount: number
        account_id: number
        benefit_card_id?: number
        original_label?: string
      }>
      default_category_id?: number
    }) => receiptsApi.confirm(data),
    onSuccess: () => {
      invalidateTransactionCaches()
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['benefit-cards'] })
      setBatchAddSuccess(document?.extracted_items?.length || 0)
      setReceiptConfirmError(null)
    },
    onError: (error) => {
      setReceiptConfirmError(getApiErrorMessage(error, 'Erro ao confirmar compra'))
    },
  })

  // Handlers
  const handleFileUpload = (file: File) => {
    // Store file for potential password retry
    setPendingPasswordFile(file)

    // Try to get credit card ID from selected credit card (if invoice mode)
    const creditCardId = selectedCreditCardId ? parseInt(selectedCreditCardId) : undefined
    setPasswordCreditCardId(creditCardId)

    // Upload with optional credit card ID for automatic password
    uploadMutation.mutate({ file, creditCardId })
  }

  // Handle password modal submit
  const handlePasswordSubmit = async (password: string, saveToCard: boolean) => {
    if (!pendingPasswordFile) return

    try {
      // Try upload with password
      const response = await documentsApi.upload(pendingPasswordFile, password, passwordCreditCardId)

      // Success - save password if requested
      if (saveToCard && passwordCreditCardId) {
        try {
          await creditCardsApi.saveInvoicePassword(passwordCreditCardId, password)
        } catch (err) {
          console.error('Failed to save password:', err)
          // Don't fail the whole flow if password save fails
        }
      }

      // Close modal and process document
      setShowPasswordModal(false)
      setPendingPasswordFile(null)
      setPasswordError(null)
      setPasswordAttemptCount(0)
      handleUploadSuccess(response)
    } catch (error) {
      // Handle password error
      const axiosErr = error as { response?: { status?: number; data?: { detail?: { message?: string } } } }
      if (axiosErr.response?.status === 422) {
        setPasswordError('Senha incorreta. Verifique e tente novamente.')
        setPasswordAttemptCount(prev => prev + 1)
        throw error // Re-throw to keep modal open
      } else {
        // Other error - close modal and show general error
        setShowPasswordModal(false)
        setUploadError(getApiErrorMessage(error, 'Erro ao processar documento'))
        throw error
      }
    }
  }

  const handleManualSubmit = () => {
    const accountId = parseInt(formData.account_id)

    // Para transferências, usar dados diferentes
    if (formData.type === 'transfer') {
      createMutation.mutate({
        type: 'transfer',
        amount: parseFloat(formData.amount),
        date: formData.date,
        account_id: accountId,
        destination_account_id: parseInt(formData.destination_account_id),
        description: formData.description || null,
        ownership_type: formData.ownership_type,
      })
      return
    }

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
      // Income split rules - para receitas
      split_rule_ids: formData.type === 'income' && formData.split_rule_ids?.length > 0
        ? formData.split_rule_ids
        : undefined,
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
    // For credit card invoices, require credit card selection and invoice reference
    if (isCreditCardInvoice && !selectedCreditCardId) return
    if (isCreditCardInvoice && (!invoiceReference.month || !invoiceReference.year)) return
    // For cupom fiscal with split payment, require all payments mapped
    if (isCupomFiscalWithSplitPayment && !allPaymentsMapped) return
    // For other documents, require account selection
    if (!isCreditCardInvoice && !isCupomFiscalWithSplitPayment && !formData.account_id) return

    setBatchAddSuccess(0)
    setBatchAddSkipped([])
    setBatchAddError(null)
    setReceiptConfirmError(null)

    // For cupom fiscal with split payments, use receipt confirmation API
    if (isCupomFiscalWithSplitPayment && document.payment_info?.payments) {
      const payments = document.payment_info.payments.map((payment, idx) => {
        const mapping = paymentMappings[idx]
        const isInstallment = mapping?.is_installment || false

        // For installment payments, get the account_id from the credit card
        let accountId = parseInt(mapping?.account_id || '0')
        if (isInstallment && mapping?.credit_card_id) {
          const card = creditCards.find((c: { id: number; account_id?: number }) => c.id === parseInt(mapping.credit_card_id))
          accountId = card?.account_id || accountId
        }

        return {
          payment_method: isInstallment ? 'credit_card' : (payment.method || 'other'),
          amount: payment.amount,
          account_id: accountId,
          benefit_card_id: mapping?.benefit_card_id ? parseInt(mapping.benefit_card_id) : undefined,
          original_label: payment.label || undefined,
          is_installment: isInstallment,
          installment_count: isInstallment ? mapping.installment_count : undefined,
          credit_card_id: isInstallment && mapping?.credit_card_id ? parseInt(mapping.credit_card_id) : undefined,
        }
      })

      const items = selectedItems.map(index => {
        const item = document.extracted_items[index]
        return {
          description: item.description || 'Item',
          amount: Math.abs(item.amount),
          category_id: findCategoryId(item.category) ? parseInt(findCategoryId(item.category)) : undefined,
          quantity: item.quantity || undefined,
          unit: item.unit || undefined,
          unit_price: item.unit_price || undefined,
          grocery_category: item.grocery_category || undefined,
          necessity_type: item.necessity_type || undefined,
        }
      })

      const totalAmount = document.payment_info.total_amount ||
        payments.reduce((sum, p) => sum + p.amount, 0)

      receiptConfirmMutation.mutate({
        document_id: document.id,
        store_name: document.payment_info?.store_name || 'Estabelecimento não identificado',
        store_cnpj: document.payment_info?.store_cnpj || undefined,
        purchase_date: document.extracted_items[0]?.date || formData.date,
        total_amount: totalAmount,
        subtotal: document.payment_info?.subtotal || undefined,
        discount: document.payment_info?.discount || undefined,
        items,
        payments,
        default_category_id: undefined,
      })
      return
    }

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
          // Invoice period (from OCR or user-edited)
          invoice_month: invoiceReference.month || null,
          invoice_year: invoiceReference.year || null,
          // Criar parcelas futuras automaticamente para itens parcelados
          create_future_installments: item.is_installment &&
            item.installment_current &&
            item.installment_total &&
            item.installment_current < item.installment_total,
          // Tipo de transacao extraido pelo LLM (pagamento, credito, estorno, compra, etc)
          extracted_transaction_type: item.transaction_type || null,
          // Campos para cupom fiscal (grocery tracking)
          quantity: item.quantity || null,
          unit: item.unit || null,
          unit_price: item.unit_price || null,
          grocery_category: item.grocery_category || null,
          necessity_type: item.necessity_type || null,
        }
      }
    })

    batchAddMutation.mutate(itemsToAdd)
  }

  const handleAddAll = () => {
    if (!document?.extracted_items) return
    // For credit card invoices, require credit card selection and invoice reference
    if (isCreditCardInvoice && !selectedCreditCardId) return
    if (isCreditCardInvoice && (!invoiceReference.month || !invoiceReference.year)) return
    // For cupom fiscal with split payment, require all payments mapped
    if (isCupomFiscalWithSplitPayment && !allPaymentsMapped) return
    // For other documents, require account selection
    if (!isCreditCardInvoice && !isCupomFiscalWithSplitPayment && !formData.account_id) return

    setSelectedItems(document.extracted_items.map((_, i) => i))
    setBatchAddSuccess(0)
    setBatchAddSkipped([])
    setBatchAddError(null)
    setReceiptConfirmError(null)

    // For cupom fiscal with split payments, use receipt confirmation API
    if (isCupomFiscalWithSplitPayment && document.payment_info?.payments) {
      const payments = document.payment_info.payments.map((payment, idx) => {
        const mapping = paymentMappings[idx]
        const isInstallment = mapping?.is_installment || false

        // For installment payments, get the account_id from the credit card
        let accountId = parseInt(mapping?.account_id || '0')
        if (isInstallment && mapping?.credit_card_id) {
          const card = creditCards.find((c: { id: number; account_id?: number }) => c.id === parseInt(mapping.credit_card_id))
          accountId = card?.account_id || accountId
        }

        return {
          payment_method: isInstallment ? 'credit_card' : (payment.method || 'other'),
          amount: payment.amount,
          account_id: accountId,
          benefit_card_id: mapping?.benefit_card_id ? parseInt(mapping.benefit_card_id) : undefined,
          original_label: payment.label || undefined,
          is_installment: isInstallment,
          installment_count: isInstallment ? mapping.installment_count : undefined,
          credit_card_id: isInstallment && mapping?.credit_card_id ? parseInt(mapping.credit_card_id) : undefined,
        }
      })

      const items = document.extracted_items.map(item => ({
        description: item.description || 'Item',
        amount: Math.abs(item.amount),
        category_id: findCategoryId(item.category) ? parseInt(findCategoryId(item.category)) : undefined,
        quantity: item.quantity || undefined,
        unit: item.unit || undefined,
        unit_price: item.unit_price || undefined,
        grocery_category: item.grocery_category || undefined,
        necessity_type: item.necessity_type || undefined,
      }))

      const totalAmount = document.payment_info.total_amount ||
        payments.reduce((sum, p) => sum + p.amount, 0)

      receiptConfirmMutation.mutate({
        document_id: document.id,
        store_name: document.payment_info?.store_name || 'Estabelecimento não identificado',
        store_cnpj: document.payment_info?.store_cnpj || undefined,
        purchase_date: document.extracted_items[0]?.date || formData.date,
        total_amount: totalAmount,
        subtotal: document.payment_info?.subtotal || undefined,
        discount: document.payment_info?.discount || undefined,
        items,
        payments,
        default_category_id: undefined,
      })
      return
    }

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
        // Invoice period (from OCR or user-edited)
        invoice_month: invoiceReference.month || null,
        invoice_year: invoiceReference.year || null,
        // Criar parcelas futuras automaticamente para itens parcelados
        create_future_installments: item.is_installment &&
          item.installment_current &&
          item.installment_total &&
          item.installment_current < item.installment_total,
        // Tipo de transacao extraido pelo LLM (pagamento, credito, estorno, compra, etc)
        extracted_transaction_type: item.transaction_type || null,
        // Campos para cupom fiscal (grocery tracking)
        quantity: item.quantity || null,
        unit: item.unit || null,
        unit_price: item.unit_price || null,
        grocery_category: item.grocery_category || null,
        necessity_type: item.necessity_type || null,
      }
    }))

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
      start_date: item.date || undefined, // Usar a data da transação na fatura
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
          start_date: item.date || undefined, // Usar a data da transação na fatura
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

  // Descartar detecção de recorrência (não é recorrente)
  const handleDismissRecurring = (index: number) => {
    if (!document?.extracted_items) return
    const updatedItems = [...document.extracted_items]
    if (updatedItems[index]?.recurring_detection) {
      updatedItems[index] = {
        ...updatedItems[index],
        recurring_detection: undefined, // Remove a detecção de recorrência
      }
      setDocument({ ...document, extracted_items: updatedItems })
    }
  }

  // Vincular parcela à série existente (resolver duplicata)
  const handleLinkToSeries = async (itemIndex: number, seriesId: number) => {
    if (!document?.extracted_items) return
    const item = document.extracted_items[itemIndex]

    try {
      // Obter account_id da conta ou do cartão
      let accountId: number
      if (isCreditCardInvoice) {
        if (!selectedCreditCardId) {
          setBatchAddError('Selecione um cartão de crédito')
          return
        }
        const selectedCard = creditCards.find((c: { id: number; account_id?: number }) => c.id === parseInt(selectedCreditCardId))
        accountId = selectedCard?.account_id || 0
        if (!accountId) {
          setBatchAddError('O cartão selecionado não possui uma conta vinculada')
          return
        }
      } else {
        accountId = formData.account_id ? parseInt(formData.account_id) : 0
        if (!accountId) {
          setBatchAddError('Selecione uma conta')
          return
        }
      }

      // Confirmar transação vinculada à série existente
      await transactionsApi.confirm({
        document_id: document.id,
        amount: Math.abs(item.amount),
        date: item.date || formData.date,
        account_id: accountId,
        category_id: findCategoryId(item.category) ? parseInt(findCategoryId(item.category)) : undefined,
        merchant_name: item.description || '',
        ownership_type: batchOwnershipType,
        is_installment: true,
        installment_current: item.installment_current,
        installment_total: item.installment_total,
        installment_series_id: seriesId, // Vincular à série existente
        credit_card_id: selectedCreditCardId ? parseInt(selectedCreditCardId) : undefined,
        invoice_month: invoiceReference.month || undefined,
        invoice_year: invoiceReference.year || undefined,
      })

      // Fechar modal
      setDuplicateModalIndex(null)

      // Remover item da lista de duplicatas potenciais
      setPotentialDuplicates(prev => {
        const updated = { ...prev }
        delete updated[itemIndex]
        return updated
      })

      // Desmarcar item
      setSelectedItems(prev => prev.filter(i => i !== itemIndex))

      // Incrementar contador de sucesso
      setBatchAddSuccess(prev => prev + 1)
    } catch (error: any) {
      console.error('Erro ao vincular parcela à série:', error)
      setBatchAddError(error.response?.data?.detail || 'Erro ao vincular parcela à série')
      setDuplicateModalIndex(null)
    }
  }

  const resetForm = () => {
    // If came directly from URL (e.g., from Transactions page), go back
    if (cameFromUrl && mode === 'manual') {
      navigate(-1)
      return
    }

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
    setInvoiceReference({ month: null, year: null })
    setShowCreateCardPrompt(false)
    setIsCreatingCard(false)
    setCreatingRecurringIndex(null)
    setCreateSuccess(null)
    setBatchOwnershipType('household')
    setPaymentMappings({})
    setReceiptConfirmError(null)
    setProcessingDocumentId(null)  // Clear processing state
  }

  // Render camera mode (single photo)
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

  // Render selection screen (fallback for desktop)
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
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isManual ? 'Nova Transação' : 'Confirmar Transação'}
          </h1>
          <HelpButton pageId="upload" />
        </div>
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
                <div className="flex flex-col gap-2 pt-2 border-t border-primary-100 dark:border-primary-800">
                  <div className="flex items-center gap-2">
                    <CreditCard size={14} className="text-primary-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {document.card_info.card_issuer?.toUpperCase() || 'Cartão'}
                      {document.card_info.card_last_digits && ` ****${document.card_info.card_last_digits}`}
                      {document.card_info.due_date && (
                        <span className="ml-1 text-gray-500 dark:text-gray-400">
                          • Venc: {new Date(document.card_info.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </span>
                  </div>
                  {/* Editable Invoice Reference Month/Year */}
                  <div className="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg p-2">
                    <span className="text-xs font-medium text-primary-700 dark:text-primary-300">Referência:</span>
                    <select
                      value={invoiceReference.month || ''}
                      onChange={(e) => setInvoiceReference(prev => ({ ...prev, month: e.target.value ? parseInt(e.target.value) : null }))}
                      className="text-xs px-2 py-1 rounded border border-primary-200 dark:border-primary-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">Mês</option>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <span className="text-gray-500">/</span>
                    <select
                      value={invoiceReference.year || ''}
                      onChange={(e) => setInvoiceReference(prev => ({ ...prev, year: e.target.value ? parseInt(e.target.value) : null }))}
                      className="text-xs px-2 py-1 rounded border border-primary-200 dark:border-primary-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">Ano</option>
                      {[2023, 2024, 2025, 2026].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    {!invoiceReference.month || !invoiceReference.year ? (
                      <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">
                        <AlertCircle size={12} className="inline mr-1" />
                        Informe o período
                      </span>
                    ) : null}
                  </div>
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

              {/* Formas de Pagamento Detectadas - Com seletores de conta para cupom fiscal */}
              {document.payment_info?.payments && document.payment_info.payments.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mt-3 space-y-3 border border-amber-100 dark:border-amber-800">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-sm text-amber-800 dark:text-amber-300">Formas de Pagamento</span>
                  </div>
                  <div className="space-y-3">
                    {document.payment_info.payments.map((payment, idx) => {
                      // Filter benefit cards by payment method (VA cards for voucher_va, etc.)
                      const isVAPayment = payment.method === 'voucher_va' || payment.label?.toLowerCase().includes('vale alimenta')
                      const isVRPayment = payment.method === 'voucher_vr' || payment.label?.toLowerCase().includes('vale refei')
                      const isCreditCardPayment = payment.method === 'credit_card' || payment.label?.toLowerCase().includes('crédito') || payment.label?.toLowerCase().includes('credito')
                      const relevantBenefitCards = benefitCards.filter((card: { card_type: string; account_id: number; id: number; current_balance: number }) => {
                        if (isVAPayment) return card.card_type === 'va' || card.card_type === 'flex'
                        if (isVRPayment) return card.card_type === 'vr' || card.card_type === 'flex'
                        return true
                      })

                      const isInstallment = paymentMappings[idx]?.is_installment || false
                      const installmentCount = paymentMappings[idx]?.installment_count || 2
                      const installmentAmount = isInstallment ? payment.amount / installmentCount : payment.amount

                      return (
                        <div key={idx} className="bg-white dark:bg-slate-800 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {payment.label || payment.method}
                            </span>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {payment.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>

                          {/* Opção de parcelamento para crédito */}
                          {isCreditCardPayment && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isInstallment}
                                  onChange={(e) => {
                                    setPaymentMappings(prev => ({
                                      ...prev,
                                      [idx]: {
                                        ...prev[idx],
                                        is_installment: e.target.checked,
                                        installment_count: e.target.checked ? 2 : 0,
                                        credit_card_id: e.target.checked ? prev[idx]?.credit_card_id || '' : '',
                                      }
                                    }))
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-blue-700 dark:text-blue-300">Parcelado no cartão</span>
                              </label>

                              {isInstallment && (
                                <div className="space-y-2 pt-2 border-t border-blue-100 dark:border-blue-800">
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">Parcelas:</label>
                                    <input
                                      type="number"
                                      min={2}
                                      max={24}
                                      value={installmentCount}
                                      onChange={(e) => {
                                        const count = Math.max(2, Math.min(24, parseInt(e.target.value) || 2))
                                        setPaymentMappings(prev => ({
                                          ...prev,
                                          [idx]: {
                                            ...prev[idx],
                                            installment_count: count,
                                          }
                                        }))
                                      }}
                                      className="w-16 px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                                    />
                                    <span className="text-xs text-blue-600 dark:text-blue-400">x</span>
                                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                      {installmentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  </div>

                                  <div>
                                    <label className="text-xs text-blue-600 dark:text-blue-400 mb-1 block">Cartão de Crédito:</label>
                                    <select
                                      value={paymentMappings[idx]?.credit_card_id || ''}
                                      onChange={(e) => {
                                        const ccId = e.target.value
                                        const card = creditCards.find((c: { id: number; account_id?: number }) => c.id === parseInt(ccId))
                                        setPaymentMappings(prev => ({
                                          ...prev,
                                          [idx]: {
                                            ...prev[idx],
                                            credit_card_id: ccId,
                                            account_id: card?.account_id?.toString() || prev[idx]?.account_id || '',
                                          }
                                        }))
                                      }}
                                      className="input text-sm"
                                    >
                                      <option value="">Selecione o cartão</option>
                                      {creditCards.map((card: { id: number; name: string }) => (
                                        <option key={card.id} value={card.id}>{card.name}</option>
                                      ))}
                                    </select>
                                  </div>

                                  {!paymentMappings[idx]?.credit_card_id && (
                                    <p className="text-xs text-red-500">Selecione o cartão para parcelamento</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Seletor de conta (para pagamentos não parcelados) */}
                          {!isInstallment && (
                            <div>
                              <select
                                value={paymentMappings[idx]?.benefit_card_id ? `bc_${paymentMappings[idx].benefit_card_id}` : paymentMappings[idx]?.account_id || ''}
                                onChange={(e) => {
                                  const value = e.target.value
                                  // Check if it's a benefit card (prefixed with 'bc_')
                                  if (value.startsWith('bc_')) {
                                    const bcId = value.replace('bc_', '')
                                    const bc = benefitCards.find((c: { id: number; account_id: number }) => c.id === parseInt(bcId))
                                    setPaymentMappings(prev => ({
                                      ...prev,
                                      [idx]: {
                                        ...prev[idx],
                                        account_id: bc?.account_id?.toString() || '',
                                        benefit_card_id: bcId,
                                        is_installment: false,
                                        installment_count: 0,
                                        credit_card_id: '',
                                      }
                                    }))
                                  } else {
                                    setPaymentMappings(prev => ({
                                      ...prev,
                                      [idx]: {
                                        ...prev[idx],
                                        account_id: value,
                                        benefit_card_id: '',
                                        is_installment: false,
                                        installment_count: 0,
                                        credit_card_id: '',
                                      }
                                    }))
                                  }
                                }}
                                className="input text-sm"
                              >
                                <option value="">Selecione a conta</option>
                                {relevantBenefitCards.length > 0 && (
                                  <optgroup label="Cartoes de Beneficio">
                                    {relevantBenefitCards.map((card: { id: number; name: string; current_balance: number; card_type_display?: string }) => (
                                      <option key={`bc_${card.id}`} value={`bc_${card.id}`}>
                                        {card.name} - Saldo: {card.current_balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                <optgroup label="Outras Contas">
                                  {accounts.map((acc: { id: number; name: string; type: string }) => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.name} ({accountTypeLabels[acc.type] || acc.type})
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {document.payment_info.payments.length > 1 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 pt-2 border-t border-amber-100 dark:border-amber-800">
                      Pagamento dividido em {document.payment_info.payments.length} formas - selecione a conta para cada pagamento
                    </p>
                  )}
                  {!allPaymentsMapped && (
                    <p className="text-xs text-red-500 dark:text-red-400">
                      Selecione uma conta para cada forma de pagamento
                    </p>
                  )}
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

        {!isManual && (document?.status === 'processing' || processingDocumentId) && (
          <div className="flex flex-col items-center gap-4 p-6 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/30 dark:to-blue-900/30 rounded-xl">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-6 w-6 rounded-full bg-primary-100 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900 dark:text-white">Processando documento...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Extraindo informações com IA. Isso pode levar alguns segundos.
              </p>
            </div>
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
            hasAccount={isCreditCardInvoice ? !!selectedCreditCardId : (isCupomFiscalWithSplitPayment ? allPaymentsMapped : !!formData.account_id)}
            batchAddPending={batchAddMutation.isPending || receiptConfirmMutation.isPending}
            batchAddSuccess={batchAddSuccess}
            batchAddSkipped={batchAddSkipped}
            batchAddError={batchAddError || receiptConfirmError}
            onClearError={() => { setBatchAddError(null); setReceiptConfirmError(null) }}
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
              setReceiptConfirmError(null)
              setPendingDuplicates([])
              setSelectedItems([])
              setEditingItemIndex(null)
              setSelectedCreditCardId('')
              setInvoiceReference({ month: null, year: null })
              setProjectedInfo({})
              setCreatingRecurringIndex(null)
              setBatchOwnershipType('household')
              setPaymentMappings({})
            }}
            projectedInfo={projectedInfo}
            isCheckingProjected={isCheckingProjected}
            potentialDuplicates={potentialDuplicates}
            onShowDuplicateModal={setDuplicateModalIndex}
            onCreateRecurring={handleCreateRecurring}
            creatingRecurringIndex={creatingRecurringIndex}
            onCreateAllRecurrences={handleCreateAllRecurrences}
            isCreatingAllRecurrences={isCreatingAllRecurrences}
            onDismissRecurring={handleDismissRecurring}
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

        {/* Account selector - shown for batch operations only when NOT editing an item and NOT split payment */}
        {(!isManual && document?.extracted_items && document.extracted_items.length > 0 && editingItemIndex === null && !isCreditCardInvoice && !isCupomFiscalWithSplitPayment) && (
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

      {/* Password Input Modal */}
      {showPasswordModal && (
        <PasswordInputModal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false)
            setPendingPasswordFile(null)
            setPasswordError(null)
            setPasswordAttemptCount(0)
          }}
          onSubmit={handlePasswordSubmit}
          creditCardId={passwordCreditCardId}
          creditCardName={
            passwordCreditCardId
              ? creditCards.find((c: { id: number; name: string }) => c.id === passwordCreditCardId)?.name
              : undefined
          }
          error={passwordError}
          attemptCount={passwordAttemptCount}
          maxAttempts={5}
        />
      )}

      {/* Modal de resolução de duplicata */}
      {duplicateModalIndex !== null && potentialDuplicates[duplicateModalIndex] && document?.extracted_items && (
        <DuplicateResolutionModal
          item={document.extracted_items[duplicateModalIndex]}
          itemIndex={duplicateModalIndex}
          duplicate={potentialDuplicates[duplicateModalIndex]}
          onLink={(seriesId) => handleLinkToSeries(duplicateModalIndex, seriesId)}
          onCreateNew={() => {
            // Criar nova série normalmente (fechar modal e permitir o fluxo normal)
            setDuplicateModalIndex(null)
          }}
          onClose={() => setDuplicateModalIndex(null)}
        />
      )}
    </div>
  )
}
