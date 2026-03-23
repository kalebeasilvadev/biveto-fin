"""
Celery tasks for notification delivery.

These tasks handle sending notifications via different channels:
- Email
- Push notifications
- Digests
"""

import asyncio
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import select, func

from app.core.celery_config import celery_app
from app.core.database import async_session_maker
from app.models.user import User
from app.models.notification import Notification, NotificationSettings
from app.core.utils import utc_now


def run_async(coro):
    """Helper to run async functions from sync Celery tasks."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.modules.notifications.tasks.delivery_tasks.send_email_notification")
def send_email_notification(notification_id: int):
    """Send a single notification via email."""
    async def _send():
        async with async_session_maker() as db:
            query = select(Notification).where(Notification.id == notification_id)
            result = await db.execute(query)
            notification = result.scalar_one_or_none()

            if not notification or notification.sent_email:
                return False

            # Get user
            user_query = select(User).where(User.id == notification.user_id)
            user_result = await db.execute(user_query)
            user = user_result.scalar_one_or_none()

            if not user:
                return False

            # TODO: Implement email sending using email_service
            # from app.core.services.email_service import send_notification_email
            # await send_notification_email(user.email, notification)

            notification.sent_email = True
            notification.sent_at = utc_now()
            await db.commit()
            return True

    return run_async(_send())


@celery_app.task(name="app.modules.notifications.tasks.delivery_tasks.send_push_notification")
def send_push_notification(notification_id: int):
    """Send a single notification via push."""
    async def _send():
        async with async_session_maker() as db:
            query = select(Notification).where(Notification.id == notification_id)
            result = await db.execute(query)
            notification = result.scalar_one_or_none()

            if not notification or notification.sent_push:
                return False

            # TODO: Implement push sending using pywebpush
            # from app.modules.notifications.services.push_service import send_push
            # await send_push(notification.user_id, notification)

            notification.sent_push = True
            await db.commit()
            return True

    return run_async(_send())


@celery_app.task(name="app.modules.notifications.tasks.delivery_tasks.send_daily_digest")
def send_daily_digest():
    """Send daily digest to users who have it enabled."""
    async def _send():
        async with async_session_maker() as db:
            # Get users with daily digest enabled
            settings_query = select(NotificationSettings).where(
                NotificationSettings.digest_enabled == True,
                NotificationSettings.digest_frequency == "daily",
            )
            settings_result = await db.execute(settings_query)
            settings_list = settings_result.scalars().all()

            count = 0
            for settings in settings_list:
                # Get yesterday's notifications
                yesterday = date.today() - timedelta(days=1)
                yesterday_start = datetime.combine(yesterday, datetime.min.time())
                yesterday_end = datetime.combine(yesterday, datetime.max.time())

                notif_query = select(Notification).where(
                    Notification.user_id == settings.user_id,
                    Notification.created_at >= yesterday_start,
                    Notification.created_at <= yesterday_end,
                )
                notif_result = await db.execute(notif_query)
                notifications = notif_result.scalars().all()

                if notifications:
                    # TODO: Send digest email
                    count += 1

            return count

    return run_async(_send())


@celery_app.task(name="app.modules.notifications.tasks.delivery_tasks.send_weekly_digest")
def send_weekly_digest():
    """Send weekly digest to users who have it enabled."""
    async def _send():
        async with async_session_maker() as db:
            # Get users with weekly digest enabled
            settings_query = select(NotificationSettings).where(
                NotificationSettings.digest_enabled == True,
                NotificationSettings.digest_frequency == "weekly",
            )
            settings_result = await db.execute(settings_query)
            settings_list = settings_result.scalars().all()

            count = 0
            for settings in settings_list:
                # Get last week's notifications
                week_ago = date.today() - timedelta(days=7)
                week_start = datetime.combine(week_ago, datetime.min.time())

                notif_query = select(Notification).where(
                    Notification.user_id == settings.user_id,
                    Notification.created_at >= week_start,
                )
                notif_result = await db.execute(notif_query)
                notifications = notif_result.scalars().all()

                if notifications:
                    # TODO: Send digest email
                    count += 1

            return count

    return run_async(_send())
