import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../services/api'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

const COLORS = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
]

export default function Dashboard() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', year, month],
    queryFn: () => analyticsApi.summary(year, month),
  })

  const summary = data?.data

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">
          {format(now, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Receitas</p>
              <p className="text-2xl font-bold text-income">
                {formatCurrency(summary?.total_income || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="text-income" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Despesas</p>
              <p className="text-2xl font-bold text-expense">
                {formatCurrency(summary?.total_expense || 0)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <TrendingDown className="text-expense" size={24} />
            </div>
          </div>
          {summary?.expense_variation != null && (
            <div className="mt-2 flex items-center text-sm">
              {summary.expense_variation > 0 ? (
                <>
                  <ArrowUpRight className="text-red-500" size={16} />
                  <span className="text-red-500">
                    +{summary.expense_variation.toFixed(1)}% vs mês anterior
                  </span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="text-green-500" size={16} />
                  <span className="text-green-500">
                    {summary.expense_variation.toFixed(1)}% vs mês anterior
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Saldo do mês</p>
              <p
                className={`text-2xl font-bold ${
                  (summary?.balance || 0) >= 0 ? 'text-income' : 'text-expense'
                }`}
              >
                {formatCurrency(summary?.balance || 0)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Wallet className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Gastos por categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Gastos por Categoria</h2>
          {summary?.categories && summary.categories.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.categories}
                      dataKey="total"
                      nameKey="category_name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                    >
                      {summary.categories.map((_: unknown, index: number) => (
                        <Cell
                          key={index}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {summary.categories.slice(0, 5).map((cat: { category_id: number; category_name: string; percentage: number }, index: number) => (
                  <div key={cat.category_id} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm flex-1 truncate">
                      {cat.category_name}
                    </span>
                    <span className="text-sm font-medium">
                      {cat.percentage.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Nenhuma transação registrada
            </p>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Top Estabelecimentos</h2>
          {summary?.top_merchants && summary.top_merchants.length > 0 ? (
            <div className="space-y-3">
              {summary.top_merchants.slice(0, 5).map((merchant: { merchant_id: number | null; merchant_name: string; total: number; count: number }) => (
                <div
                  key={merchant.merchant_id || 'other'}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{merchant.merchant_name}</p>
                    <p className="text-sm text-gray-500">
                      {merchant.count} transações
                    </p>
                  </div>
                  <span className="font-semibold">
                    {formatCurrency(merchant.total)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Nenhum estabelecimento registrado
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
