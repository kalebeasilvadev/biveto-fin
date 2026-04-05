"""
Celery configuration for background tasks.

To run the worker:
    celery -A app.core.celery_config worker --loglevel=info

To run the beat scheduler:
    celery -A app.core.celery_config beat --loglevel=info

For development, run both together:
    celery -A app.core.celery_config worker --beat --loglevel=info
"""

from celery import Celery
from celery.schedules import crontab
from .config import settings

# Create Celery app
celery_app = Celery(
    "biveto",
    broker=settings.redis_url if hasattr(settings, 'redis_url') else "redis://localhost:6379/0",
    backend=settings.redis_url if hasattr(settings, 'redis_url') else "redis://localhost:6379/0",
    include=[
        "app.modules.notifications.tasks.alert_tasks",
        "app.modules.notifications.tasks.delivery_tasks",
        "app.modules.automations.tasks.automation_tasks",
    ],
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Sao_Paulo",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    # Check invoice due dates every day at 8:00 AM
    "check-invoice-due-dates": {
        "task": "app.modules.notifications.tasks.alert_tasks.check_invoice_due_dates",
        "schedule": crontab(hour=8, minute=0),
    },
    # Check budget thresholds every 6 hours
    "check-budget-thresholds": {
        "task": "app.modules.notifications.tasks.alert_tasks.check_budget_thresholds",
        "schedule": crontab(hour="*/6", minute=15),
    },
    # Check credit card limits every 6 hours
    "check-credit-card-limits": {
        "task": "app.modules.notifications.tasks.alert_tasks.check_credit_card_limits",
        "schedule": crontab(hour="*/6", minute=30),
    },
    # Check goal milestones twice a day
    "check-goal-milestones": {
        "task": "app.modules.notifications.tasks.alert_tasks.check_goal_milestones",
        "schedule": crontab(hour="9,18", minute=0),
    },
    # Check recurring transactions due tomorrow at 6 PM
    "check-recurring-due": {
        "task": "app.modules.notifications.tasks.alert_tasks.check_recurring_due",
        "schedule": crontab(hour=18, minute=0),
    },
    # Check low balances every day at 9 AM
    "check-low-balance": {
        "task": "app.modules.notifications.tasks.alert_tasks.check_low_balance",
        "schedule": crontab(hour=9, minute=30),
    },
    # Process scheduled automations every hour
    "process-scheduled-automations": {
        "task": "automations.process_scheduled",
        "schedule": crontab(minute=0),  # Every hour at :00
    },
    # Process threshold automations every 6 hours
    "process-threshold-automations": {
        "task": "automations.process_thresholds",
        "schedule": crontab(hour="*/6", minute=45),
    },
    # Remind about missing invoices on the 1st of each month at 10:00 local
    # (13:00 UTC for America/Sao_Paulo). Notifications are staggered 5min apart
    # inside the task to avoid a burst of pushes.
    "check-missing-invoices-start-of-month": {
        "task": "app.modules.notifications.tasks.alert_tasks.check_missing_invoices_start_of_month",
        "schedule": crontab(hour=13, minute=0, day_of_month=1),
    },
    # Remind about missing invoices 3 days before due date - daily at 10:00 local
    "check-missing-invoices-pre-due": {
        "task": "app.modules.notifications.tasks.alert_tasks.check_missing_invoices_pre_due",
        "schedule": crontab(hour=13, minute=10),
    },
    # Expire obsolete missing-invoice notifications daily
    "expire-missing-invoice-notifications": {
        "task": "app.modules.notifications.tasks.alert_tasks.expire_missing_invoice_notifications",
        "schedule": crontab(hour=4, minute=0),
    },
}
