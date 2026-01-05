from datetime import date
from fastapi import APIRouter, Query

from ..core.deps import CurrentUser, DbSession
from ..schemas.analytics import AnalyticsSummary, InsightResponse
from ..services.analytics_service import AnalyticsService

router = APIRouter()


@router.get("/summary", response_model=AnalyticsSummary)
async def get_monthly_summary(
    current_user: CurrentUser,
    db: DbSession,
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
):
    """
    Retorna resumo analítico do mês:
    - Totais de receita/despesa
    - Gastos por categoria
    - Top merchants
    - Comparativo com mês anterior
    """
    service = AnalyticsService(db)
    return await service.get_monthly_summary(current_user, year, month)


@router.get("/insights", response_model=list[InsightResponse])
async def get_insights(
    current_user: CurrentUser,
    db: DbSession,
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """
    Retorna insights explicáveis sobre os gastos:
    - Vazamentos (gastos pequenos frequentes)
    - Drivers (principais categorias)
    - Oportunidades de economia
    """
    service = AnalyticsService(db)
    return await service.get_insights(current_user, start_date, end_date)
