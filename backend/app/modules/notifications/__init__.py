"""Notifications module for alerts and push notifications."""
from app.modules.notifications.routers.notifications import router
from app.modules.notifications.services.notification_service import NotificationService
from app.modules.notifications.schemas.notification import (
    NotificationCreate,
    NotificationResponse,
    NotificationSummary,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationSettingsResponse,
    NotificationSettingsUpdate,
    PushSubscriptionCreate,
)

__all__ = [
    "router",
    "NotificationService",
    "NotificationCreate",
    "NotificationResponse",
    "NotificationSummary",
    "NotificationPreferenceResponse",
    "NotificationPreferenceUpdate",
    "NotificationSettingsResponse",
    "NotificationSettingsUpdate",
    "PushSubscriptionCreate",
]
