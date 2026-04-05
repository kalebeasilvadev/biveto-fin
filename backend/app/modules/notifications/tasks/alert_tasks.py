"""
Celery tasks for alert detection.

These tasks run periodically to check for financial events
and generate notifications for users.
"""

import asyncio
from sqlalchemy import select

from app.core.celery_config import celery_app
from app.core.database import async_session_maker
from app.models.user import User
from app.modules.notifications.services.alert_engine import AlertEngine


def run_async(coro):
    """Helper to run async functions from sync Celery tasks."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def get_all_active_users():
    """Get all active users."""
    async with async_session_maker() as db:
        query = select(User).where(User.is_active == True)
        result = await db.execute(query)
        return result.scalars().all()


@celery_app.task(name="app.modules.notifications.tasks.alert_tasks.check_invoice_due_dates")
def check_invoice_due_dates():
    """Check all users for invoices approaching due date."""
    async def _check():
        users = await get_all_active_users()
        total_notifications = 0

        for user in users:
            async with async_session_maker() as db:
                engine = AlertEngine(db)
                count = await engine.check_invoice_due_dates(user)
                await db.commit()
                total_notifications += count

        return total_notifications

    return run_async(_check())


@celery_app.task(name="app.modules.notifications.tasks.alert_tasks.check_budget_thresholds")
def check_budget_thresholds():
    """Check all users for budget thresholds exceeded."""
    async def _check():
        users = await get_all_active_users()
        total_notifications = 0

        for user in users:
            async with async_session_maker() as db:
                engine = AlertEngine(db)
                count = await engine.check_budget_thresholds(user)
                await db.commit()
                total_notifications += count

        return total_notifications

    return run_async(_check())


@celery_app.task(name="app.modules.notifications.tasks.alert_tasks.check_credit_card_limits")
def check_credit_card_limits():
    """Check all users for credit card limit warnings."""
    async def _check():
        users = await get_all_active_users()
        total_notifications = 0

        for user in users:
            async with async_session_maker() as db:
                engine = AlertEngine(db)
                count = await engine.check_credit_card_limits(user)
                await db.commit()
                total_notifications += count

        return total_notifications

    return run_async(_check())


@celery_app.task(name="app.modules.notifications.tasks.alert_tasks.check_goal_milestones")
def check_goal_milestones():
    """Check all users for goal milestones reached."""
    async def _check():
        users = await get_all_active_users()
        total_notifications = 0

        for user in users:
            async with async_session_maker() as db:
                engine = AlertEngine(db)
                count = await engine.check_goal_milestones(user)
                await db.commit()
                total_notifications += count

        return total_notifications

    return run_async(_check())


@celery_app.task(name="app.modules.notifications.tasks.alert_tasks.check_recurring_due")
def check_recurring_due():
    """Check all users for recurring transactions due tomorrow."""
    async def _check():
        users = await get_all_active_users()
        total_notifications = 0

        for user in users:
            async with async_session_maker() as db:
                engine = AlertEngine(db)
                count = await engine.check_recurring_due(user)
                await db.commit()
                total_notifications += count

        return total_notifications

    return run_async(_check())


@celery_app.task(name="app.modules.notifications.tasks.alert_tasks.check_low_balance")
def check_low_balance():
    """Check all users for low account balances."""
    async def _check():
        users = await get_all_active_users()
        total_notifications = 0

        for user in users:
            async with async_session_maker() as db:
                engine = AlertEngine(db)
                count = await engine.check_low_balance(user)
                await db.commit()
                total_notifications += count

        return total_notifications

    return run_async(_check())


@celery_app.task(name="app.modules.notifications.tasks.alert_tasks.check_missing_invoices_start_of_month")
def check_missing_invoices_start_of_month():
    """
    Check all users for missing invoices of the previous month.
    Runs on the 1st of each month - self-guards if called on other days.
    """
    async def _check():
        users = await get_all_active_users()
        total_notifications = 0

        for user in users:
            async with async_session_maker() as db:
                engine = AlertEngine(db)
                count = await engine.check_missing_invoices_start_of_month(user)
                await db.commit()
                total_notifications += count

        return total_notifications

    return run_async(_check())


@celery_app.task(name="app.modules.notifications.tasks.alert_tasks.check_missing_invoices_pre_due")
def check_missing_invoices_pre_due():
    """
    Check all users for invoices due in 3 days that haven't been loaded yet.
    Runs daily.
    """
    async def _check():
        users = await get_all_active_users()
        total_notifications = 0

        for user in users:
            async with async_session_maker() as db:
                engine = AlertEngine(db)
                count = await engine.check_missing_invoices_pre_due(user)
                await db.commit()
                total_notifications += count

        return total_notifications

    return run_async(_check())


@celery_app.task(name="app.modules.notifications.tasks.alert_tasks.expire_missing_invoice_notifications")
def expire_missing_invoice_notifications():
    """
    Cleanup task: marks as dismissed any INVOICE_MISSING_* notifications
    that are no longer relevant (month changed, due_date long past, etc).
    Runs daily to prevent notification "graveyard".
    """
    from datetime import date, timedelta
    from app.models.notification import Notification, NotificationType

    async def _check():
        today = date.today()
        dismissed_total = 0

        async with async_session_maker() as db:
            query = select(Notification).where(
                Notification.is_dismissed == False,
                Notification.type.in_([
                    NotificationType.INVOICE_MISSING_CURRENT.value,
                    NotificationType.INVOICE_MISSING_PRE_DUE.value,
                ]),
            )
            result = await db.execute(query)
            notifications = result.scalars().all()

            from app.core.utils import utc_now
            now = utc_now()

            for notification in notifications:
                data = notification.extra_data or {}
                ref_month = data.get("ref_month")
                ref_year = data.get("ref_year")
                due_date_str = data.get("due_date")

                should_expire = False

                # Regra 1: INVOICE_MISSING_CURRENT expira quando o mes corrente
                # passa do mes seguinte ao mes de referencia
                if notification.type == NotificationType.INVOICE_MISSING_CURRENT.value:
                    if ref_month and ref_year:
                        # Expira quando estamos 2+ meses adiante do mes de referencia
                        months_diff = (today.year - ref_year) * 12 + (today.month - ref_month)
                        if months_diff >= 2:
                            should_expire = True

                # Regra 2: INVOICE_MISSING_PRE_DUE expira 10 dias apos o due_date
                if notification.type == NotificationType.INVOICE_MISSING_PRE_DUE.value:
                    if due_date_str:
                        try:
                            due_date = date.fromisoformat(due_date_str)
                            if (today - due_date).days >= 10:
                                should_expire = True
                        except (ValueError, TypeError):
                            pass

                if should_expire:
                    notification.is_dismissed = True
                    notification.dismissed_at = now
                    dismissed_total += 1

            if dismissed_total:
                await db.commit()

        return dismissed_total

    return run_async(_check())


@celery_app.task(name="app.modules.notifications.tasks.alert_tasks.check_all_alerts_for_user")
def check_all_alerts_for_user(user_id: int):
    """Check all alerts for a specific user. Can be triggered manually."""
    async def _check():
        async with async_session_maker() as db:
            query = select(User).where(User.id == user_id)
            result = await db.execute(query)
            user = result.scalar_one_or_none()

            if not user:
                return 0

            engine = AlertEngine(db)
            count = await engine.check_all_alerts_for_user(user)
            await db.commit()
            return count

    return run_async(_check())
