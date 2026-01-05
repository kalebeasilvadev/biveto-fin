from datetime import date as date_type
from pydantic import BaseModel


class CategorySummary(BaseModel):
    category_id: int
    category_name: str
    total: float
    count: int
    percentage: float
    average: float
    trend: float | None = None  # variação vs período anterior


class MerchantSummary(BaseModel):
    merchant_id: int | None
    merchant_name: str
    total: float
    count: int


class AnalyticsSummary(BaseModel):
    period_start: date_type
    period_end: date_type

    total_income: float
    total_expense: float
    balance: float
    margin: float  # receita - despesa

    fixed_expenses: float
    variable_expenses: float

    categories: list[CategorySummary]
    top_merchants: list[MerchantSummary]

    # Comparativo
    previous_period_expense: float | None = None
    expense_variation: float | None = None


class InsightType(str):
    LEAK = "leak"  # vazamentos (pequenos gastos recorrentes)
    DRIVER = "driver"  # principal driver de aumento
    OPPORTUNITY = "opportunity"  # oportunidade de corte
    ANOMALY = "anomaly"  # gasto fora do padrão


class InsightResponse(BaseModel):
    type: str
    title: str
    description: str
    impact_value: float  # impacto mensal estimado
    calculation: str  # explicação do cálculo
    action: str  # ação sugerida
    category_id: int | None = None
    merchant_id: int | None = None
