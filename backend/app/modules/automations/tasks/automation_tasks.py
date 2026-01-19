"""
Celery tasks for processing automation rules.
"""

import logging
from datetime import datetime, date, time

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models import (
    AutomationRule,
    TriggerType,
    ScheduleFrequency,
)
from app.modules.automations.services import AutomationService

logger = logging.getLogger(__name__)


@shared_task(name="automations.process_scheduled")
def process_scheduled_automations():
    """
    Process all scheduled automation rules.
    Called periodically by Celery Beat (e.g., every hour).
    """
    import asyncio

    async def _process():
        async with async_session_factory() as session:
            now = datetime.now()
            current_time = now.time()
            current_date = now.date()

            # Get all active scheduled rules
            result = await session.execute(
                select(AutomationRule)
                .where(
                    AutomationRule.is_active == True,
                    AutomationRule.trigger_type == TriggerType.SCHEDULE.value,
                )
            )
            rules = result.scalars().all()

            service = AutomationService(session)
            executed_count = 0
            skipped_count = 0

            for rule in rules:
                try:
                    should_run = _should_run_scheduled(rule, current_date, current_time)

                    if should_run:
                        # Check if already executed today/this period
                        if rule.last_executed_at:
                            last_exec_date = rule.last_executed_at.date()
                            config = rule.trigger_config
                            frequency = config.get("frequency", "daily")

                            # Skip if already executed in current period
                            if frequency == "daily" and last_exec_date == current_date:
                                skipped_count += 1
                                continue
                            elif frequency == "weekly":
                                # Same week
                                if last_exec_date.isocalendar()[1] == current_date.isocalendar()[1]:
                                    skipped_count += 1
                                    continue
                            elif frequency == "monthly":
                                # Same month
                                if (last_exec_date.year == current_date.year and
                                        last_exec_date.month == current_date.month):
                                    skipped_count += 1
                                    continue

                        # Execute the rule
                        trigger_reason = f"schedule:{rule.trigger_config.get('frequency')}:{current_date.isoformat()}"
                        await service.execute_rule(rule, trigger_reason)
                        executed_count += 1
                        logger.info(f"Executed scheduled rule {rule.id}: {rule.name}")

                except Exception as e:
                    logger.exception(f"Error processing rule {rule.id}: {e}")

            logger.info(
                f"Processed scheduled automations: {executed_count} executed, {skipped_count} skipped"
            )
            return {"executed": executed_count, "skipped": skipped_count}

    return asyncio.run(_process())


def _should_run_scheduled(rule: AutomationRule, current_date: date, current_time: time) -> bool:
    """Determine if a scheduled rule should run now."""
    config = rule.trigger_config
    frequency = config.get("frequency", "daily")
    scheduled_time_str = config.get("time", "08:00")

    # Parse scheduled time
    try:
        hour, minute = map(int, scheduled_time_str.split(":"))
        scheduled_time = time(hour, minute)
    except (ValueError, AttributeError):
        scheduled_time = time(8, 0)

    # Check if within time window (1 hour window)
    time_diff = abs(
        (current_time.hour * 60 + current_time.minute) -
        (scheduled_time.hour * 60 + scheduled_time.minute)
    )
    if time_diff > 60:  # Not within 1 hour window
        return False

    if frequency == ScheduleFrequency.DAILY.value:
        return True

    elif frequency == ScheduleFrequency.WEEKLY.value:
        day_of_week = config.get("day_of_week", 0)  # 0 = Monday
        return current_date.weekday() == day_of_week

    elif frequency == ScheduleFrequency.BIWEEKLY.value:
        day_of_week = config.get("day_of_week", 0)
        if current_date.weekday() != day_of_week:
            return False
        # Check if it's an even or odd week based on rule creation
        week_number = current_date.isocalendar()[1]
        return week_number % 2 == 0

    elif frequency == ScheduleFrequency.MONTHLY.value:
        day_of_month = config.get("day_of_month", 1)
        return current_date.day == day_of_month

    return False


@shared_task(name="automations.process_thresholds")
def process_threshold_automations():
    """
    Process all threshold-based automation rules.
    Called periodically by Celery Beat (e.g., every 6 hours).
    """
    import asyncio

    async def _process():
        async with async_session_factory() as session:
            # Get all active threshold rules
            result = await session.execute(
                select(AutomationRule)
                .where(
                    AutomationRule.is_active == True,
                    AutomationRule.trigger_type == TriggerType.THRESHOLD.value,
                )
            )
            rules = result.scalars().all()

            service = AutomationService(session)
            executed_count = 0
            today = date.today()

            for rule in rules:
                try:
                    # Check if already executed today (to avoid spam)
                    if rule.last_executed_at:
                        if rule.last_executed_at.date() == today:
                            continue

                    # Evaluate conditions (threshold is part of conditions)
                    conditions_met, _ = await service._evaluate_conditions(rule, None)

                    if conditions_met:
                        trigger_reason = f"threshold:{rule.trigger_config.get('threshold_type')}:{today.isoformat()}"
                        await service.execute_rule(rule, trigger_reason)
                        executed_count += 1
                        logger.info(f"Executed threshold rule {rule.id}: {rule.name}")

                except Exception as e:
                    logger.exception(f"Error processing threshold rule {rule.id}: {e}")

            logger.info(f"Processed threshold automations: {executed_count} executed")
            return {"executed": executed_count}

    return asyncio.run(_process())


@shared_task(name="automations.process_event")
def process_event_automation(event_type: str, context: dict):
    """
    Process event-triggered automations.
    Called when specific events occur (e.g., transaction created).
    """
    import asyncio

    async def _process():
        async with async_session_factory() as session:
            # Get all active event rules matching this event type
            result = await session.execute(
                select(AutomationRule)
                .where(
                    AutomationRule.is_active == True,
                    AutomationRule.trigger_type == TriggerType.EVENT.value,
                )
            )
            rules = result.scalars().all()

            service = AutomationService(session)
            executed_count = 0

            for rule in rules:
                try:
                    config = rule.trigger_config
                    rule_event_type = config.get("event_type")

                    if rule_event_type != event_type:
                        continue

                    # Check filters
                    filters = config.get("filters", {})
                    if not _matches_filters(context, filters):
                        continue

                    trigger_reason = f"event:{event_type}:{context.get('id', 'unknown')}"
                    await service.execute_rule(rule, trigger_reason, context)
                    executed_count += 1
                    logger.info(f"Executed event rule {rule.id}: {rule.name}")

                except Exception as e:
                    logger.exception(f"Error processing event rule {rule.id}: {e}")

            logger.info(f"Processed event automations: {executed_count} executed")
            return {"executed": executed_count}

    return asyncio.run(_process())


def _matches_filters(context: dict, filters: dict) -> bool:
    """Check if context matches the filters."""
    for key, value in filters.items():
        if key == "description_contains":
            desc = context.get("description", "")
            if value.lower() not in desc.lower():
                return False
        elif key == "amount_min":
            amount = context.get("amount", 0)
            if amount < value:
                return False
        elif key == "amount_max":
            amount = context.get("amount", 0)
            if amount > value:
                return False
        elif key in context:
            if context[key] != value:
                return False

    return True
