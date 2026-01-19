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
