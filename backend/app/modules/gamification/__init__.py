"""
Gamification Module

Sistema de gamificação para o Biveto com:
- Badges (conquistas)
- Streaks (sequências de uso)
- Challenges (desafios mensais)
- Points (sistema de pontos)
"""

from .routers.gamification import router
from .services import (
    GamificationService,
    BadgeService,
    StreakService,
    ChallengeService,
    PointsService,
)
from .schemas import (
    GamificationSummary,
    GamificationEvent,
    BadgeResponse,
    StreakResponse,
    StreakWeekView,
    ChallengeResponse,
    ChallengeListResponse,
)

__all__ = [
    "router",
    "GamificationService",
    "BadgeService",
    "StreakService",
    "ChallengeService",
    "PointsService",
    "GamificationSummary",
    "GamificationEvent",
    "BadgeResponse",
    "StreakResponse",
    "StreakWeekView",
    "ChallengeResponse",
    "ChallengeListResponse",
]
