import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { transactionsApi, categoriesApi } from '../services/api'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Filter, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Transaction {
  id: number
  type: 'expense' | 'income'
  amount: number
  date: string
  description: string | null
  category_name: string | null
  merchant_name: string | null
}

export default function Transactions() {
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['transactions', categoryFilter],
    queryFn: () =>
      transactionsApi.list({
        category_id: categoryFilter || undefined,
        limit: 100,
      }),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const transactions: Transaction[] = transactionsData?.data || []
  const categories = categoriesData?.data || []

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)

  // Agrupar por data
  const groupedTransactions = transactions.reduce(
    (groups: Record<string, Transaction[]>, transaction) => {
      const date = transaction.date
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(transaction)
      return groups
    },
    {}
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transações</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center gap-2"
          >
            <Filter size={18} />
            Filtros
          </button>
          <Link to="/upload" className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            Adicionar
          </Link>
        </div>
      </div>

      {showFilters && (
        <div className="card">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input"
              >
                <option value="">Todas</option>
                {categories.map((cat: { id: number; name: string }) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">Nenhuma transação encontrada</p>
          <Link to="/upload" className="btn-primary inline-flex items-center gap-2">
            <Plus size={18} />
            Adicionar primeira transação
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                {format(new Date(date), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h3>
              <div className="card divide-y">
                {dayTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          transaction.type === 'income'
                            ? 'bg-green-100'
                            : 'bg-red-100'
                        }`}
                      >
                        {transaction.type === 'income' ? (
                          <ArrowUpRight className="text-income" size={18} />
                        ) : (
                          <ArrowDownRight className="text-expense" size={18} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {transaction.merchant_name ||
                            transaction.description ||
                            'Transação'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {transaction.category_name || 'Sem categoria'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-semibold ${
                        transaction.type === 'income'
                          ? 'text-income'
                          : 'text-expense'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
