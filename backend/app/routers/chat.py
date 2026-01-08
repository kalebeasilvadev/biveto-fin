"""Router para o Agente IA Financeiro"""
from fastapi import APIRouter

from ..core.deps import CurrentUser, DbSession
from ..schemas.chat import ChatRequest, ChatResponse
from ..services.financial_agent_service import FinancialAgentService


router = APIRouter()


@router.post("", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Envia mensagem para o Agente IA Financeiro.

    O agente analisa seus dados financeiros (transações, dívidas, metas, orçamentos)
    e fornece recomendações personalizadas.

    - **message**: Sua pergunta ou mensagem para o agente
    - **conversation_id**: ID da conversa (opcional, para continuar uma conversa existente)
    """
    service = FinancialAgentService(db)
    return await service.chat(current_user, request.message, request.conversation_id)


@router.get("/suggestions")
async def get_suggestions(
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Retorna sugestões de perguntas iniciais baseadas nos dados do usuário.
    """
    service = FinancialAgentService(db)
    query_context = {"period": None}
    context = await service._get_comprehensive_context(current_user, query_context)
    suggestions = service._generate_smart_suggestions("", context)

    return {
        "suggestions": suggestions,
        "welcome_message": "Olá! Sou o Fin, seu assistente financeiro pessoal. Como posso ajudar você hoje?"
    }
