"""Goals module - Financial goals management"""
from app.modules.goals.routers.goals import router
from app.modules.goals.services.goal_service import GoalService
from app.modules.goals.schemas.goal import (
    GoalCreate,
    GoalUpdate,
    GoalContributionCreate,
    GoalResponse,
    GoalDetailResponse,
    GoalContributionResponse,
    GoalProjection,
    GoalSummary,
    GoalMilestone,
    EmergencyFundCalculation,
    PNIFCalculation,
)

__all__ = [
    "router",
    "GoalService",
    "GoalCreate",
    "GoalUpdate",
    "GoalContributionCreate",
    "GoalResponse",
    "GoalDetailResponse",
    "GoalContributionResponse",
    "GoalProjection",
    "GoalSummary",
    "GoalMilestone",
    "EmergencyFundCalculation",
    "PNIFCalculation",
]
