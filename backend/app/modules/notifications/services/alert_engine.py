"""
Alert Engine - Detects financial events and generates notifications.

This service analyzes user data to detect important financial events:
- Invoice due dates approaching
- Budget thresholds exceeded
- Credit card limit warnings
- Goal milestones reached
- Low balance warnings
- Recurring transactions due
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.user import User
from app.models.notification import (
    Notification,
    NotificationType,
    NotificationPriority,
)
from app.models.credit_card_invoice import CreditCardInvoice, InvoiceStatus
from app.models.budget import Budget, BudgetItem
from app.models.credit_card import CreditCard
from app.models.goal import Goal, GoalStatus
from app.models.account import Account
from app.models.recurring import RecurringTransaction, RecurringStatus
from app.models.transaction import Transaction

from .notification_service import NotificationService


class AlertEngine:
    """Engine for detecting financial alerts and generating notifications."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.notification_service = NotificationService(db)

    async def check_all_alerts_for_user(self, user: User) -> int:
        """
        Run all alert checks for a user.
        Returns the number of notifications created.
        """
        count = 0
        count += await self.check_invoice_due_dates(user)
        count += await self.check_budget_thresholds(user)
        count += await self.check_credit_card_limits(user)
        count += await self.check_goal_milestones(user)
        count += await self.check_low_balance(user)
        count += await self.check_recurring_due(user)
        return count

    async def check_invoice_due_dates(self, user: User) -> int:
        """Check for invoices approaching due date."""
        today = date.today()
        count = 0

        # Get open invoices
        query = select(CreditCardInvoice).where(
            CreditCardInvoice.user_id == user.id,
            CreditCardInvoice.status == InvoiceStatus.OPEN.value,
            CreditCardInvoice.due_date >= today,
        )
        result = await self.db.execute(query)
        invoices = result.scalars().all()

        for invoice in invoices:
            days_until_due = (invoice.due_date - today).days

            # Check if notification already sent
            notification_type = None
            if days_until_due == 7:
                notification_type = NotificationType.INVOICE_DUE_7_DAYS
            elif days_until_due == 3:
                notification_type = NotificationType.INVOICE_DUE_3_DAYS
            elif days_until_due == 1:
                notification_type = NotificationType.INVOICE_DUE_1_DAY

            if notification_type:
                if not await self._notification_exists(
                    user.id, notification_type, "invoice", invoice.id
                ):
                    await self.notification_service.send_notification(
                        user_id=user.id,
                        notification_type=notification_type,
                        title=f"Fatura vence em {days_until_due} {'dia' if days_until_due == 1 else 'dias'}",
                        message=f"A fatura de R$ {invoice.total_amount:.2f} vence em {invoice.due_date.strftime('%d/%m')}.",
                        entity_type="invoice",
                        entity_id=invoice.id,
                        action_url=f"/invoices/{invoice.id}",
                        action_label="Ver fatura",
                        priority=NotificationPriority.HIGH if days_until_due <= 3 else NotificationPriority.NORMAL,
                        icon="credit-card",
                        color="orange" if days_until_due > 1 else "red",
                    )
                    count += 1

        # Check overdue invoices
        overdue_query = select(CreditCardInvoice).where(
            CreditCardInvoice.user_id == user.id,
            CreditCardInvoice.status == InvoiceStatus.OPEN.value,
            CreditCardInvoice.due_date < today,
        )
        overdue_result = await self.db.execute(overdue_query)
        overdue_invoices = overdue_result.scalars().all()

        for invoice in overdue_invoices:
            if not await self._notification_exists(
                user.id, NotificationType.INVOICE_OVERDUE, "invoice", invoice.id
            ):
                days_overdue = (today - invoice.due_date).days
                await self.notification_service.send_notification(
                    user_id=user.id,
                    notification_type=NotificationType.INVOICE_OVERDUE,
                    title="Fatura vencida!",
                    message=f"A fatura de R$ {invoice.total_amount:.2f} está vencida há {days_overdue} {'dia' if days_overdue == 1 else 'dias'}.",
                    entity_type="invoice",
                    entity_id=invoice.id,
                    action_url=f"/invoices/{invoice.id}",
                    action_label="Pagar agora",
                    priority=NotificationPriority.URGENT,
                    icon="alert-triangle",
                    color="red",
                )
                count += 1

        return count

    async def check_budget_thresholds(self, user: User) -> int:
        """Check for budget thresholds exceeded."""
        today = date.today()
        count = 0

        # Get current month's budget
        query = select(Budget).where(
            Budget.user_id == user.id,
            Budget.year == today.year,
            Budget.month == today.month,
        )
        result = await self.db.execute(query)
        budget = result.scalar_one_or_none()

        if not budget:
            return 0

        # Get budget items with spending
        items_query = select(BudgetItem).where(BudgetItem.budget_id == budget.id)
        items_result = await self.db.execute(items_query)
        items = items_result.scalars().all()

        # Fetch ALL category spending in ONE query (instead of N queries)
        category_ids = [item.category_id for item in items if item.limit_amount > 0 and item.category_id]
        spending_by_category: dict[int, Decimal] = {}
        if category_ids:
            spending_query = select(
                Transaction.category_id,
                func.coalesce(func.sum(Transaction.amount), 0).label("spent"),
            ).where(
                Transaction.user_id == user.id,
                Transaction.category_id.in_(category_ids),
                Transaction.type == "expense",
                func.extract("year", Transaction.date) == today.year,
                func.extract("month", Transaction.date) == today.month,
            ).group_by(Transaction.category_id)
            spending_result = await self.db.execute(spending_query)
            spending_by_category = {row.category_id: row.spent for row in spending_result.all()}

        for item in items:
            if item.limit_amount <= 0:
                continue

            spent = spending_by_category.get(item.category_id, Decimal(0))

            percentage = float(spent / item.limit_amount * 100)

            if percentage >= 100:
                if not await self._notification_exists(
                    user.id, NotificationType.BUDGET_EXCEEDED, "budget_item", item.id
                ):
                    await self.notification_service.send_notification(
                        user_id=user.id,
                        notification_type=NotificationType.BUDGET_EXCEEDED,
                        title="Orçamento excedido!",
                        message=f"Você gastou R$ {spent:.2f} de R$ {item.limit_amount:.2f} em {item.category.name if item.category else 'uma categoria'}.",
                        entity_type="budget_item",
                        entity_id=item.id,
                        action_url="/budget",
                        action_label="Ver orçamento",
                        priority=NotificationPriority.HIGH,
                        icon="wallet",
                        color="red",
                    )
                    count += 1
            elif percentage >= 80:
                if not await self._notification_exists(
                    user.id, NotificationType.BUDGET_WARNING_80, "budget_item", item.id
                ):
                    await self.notification_service.send_notification(
                        user_id=user.id,
                        notification_type=NotificationType.BUDGET_WARNING_80,
                        title="Orçamento em 80%",
                        message=f"Você já gastou {percentage:.0f}% do orçamento em {item.category.name if item.category else 'uma categoria'}.",
                        entity_type="budget_item",
                        entity_id=item.id,
                        action_url="/budget",
                        action_label="Ver orçamento",
                        priority=NotificationPriority.NORMAL,
                        icon="wallet",
                        color="orange",
                    )
                    count += 1

        return count

    async def check_credit_card_limits(self, user: User) -> int:
        """Check for credit card limit warnings."""
        count = 0

        query = select(CreditCard).where(
            CreditCard.user_id == user.id,
            CreditCard.is_active == True,
        )
        result = await self.db.execute(query)
        cards = result.scalars().all()

        for card in cards:
            if not card.credit_limit or card.credit_limit <= 0:
                continue

            # Get current invoice total
            today = date.today()
            invoice_query = select(CreditCardInvoice).where(
                CreditCardInvoice.credit_card_id == card.id,
                CreditCardInvoice.status == InvoiceStatus.OPEN.value,
            )
            invoice_result = await self.db.execute(invoice_query)
            current_invoice = invoice_result.scalar_one_or_none()

            if not current_invoice:
                continue

            used = current_invoice.total_amount or Decimal(0)
            percentage = float(used / card.credit_limit * 100)

            if percentage >= 100:
                if not await self._notification_exists(
                    user.id, NotificationType.CREDIT_LIMIT_EXCEEDED, "credit_card", card.id
                ):
                    await self.notification_service.send_notification(
                        user_id=user.id,
                        notification_type=NotificationType.CREDIT_LIMIT_EXCEEDED,
                        title="Limite do cartão excedido!",
                        message=f"O cartão {card.name} excedeu o limite de R$ {card.credit_limit:.2f}.",
                        entity_type="credit_card",
                        entity_id=card.id,
                        action_url=f"/credit-cards/{card.id}",
                        action_label="Ver cartão",
                        priority=NotificationPriority.URGENT,
                        icon="credit-card",
                        color="red",
                    )
                    count += 1
            elif percentage >= 80:
                if not await self._notification_exists(
                    user.id, NotificationType.CREDIT_LIMIT_80, "credit_card", card.id
                ):
                    await self.notification_service.send_notification(
                        user_id=user.id,
                        notification_type=NotificationType.CREDIT_LIMIT_80,
                        title="Limite do cartão em 80%",
                        message=f"O cartão {card.name} está com {percentage:.0f}% do limite usado.",
                        entity_type="credit_card",
                        entity_id=card.id,
                        action_url=f"/credit-cards/{card.id}",
                        action_label="Ver cartão",
                        priority=NotificationPriority.NORMAL,
                        icon="credit-card",
                        color="orange",
                    )
                    count += 1

        return count

    async def check_goal_milestones(self, user: User) -> int:
        """Check for goal milestones reached."""
        count = 0

        query = select(Goal).where(
            Goal.user_id == user.id,
            Goal.status == GoalStatus.ACTIVE.value,
        )
        result = await self.db.execute(query)
        goals = result.scalars().all()

        for goal in goals:
            if goal.target_amount <= 0:
                continue

            percentage = float(goal.current_amount / goal.target_amount * 100)

            # Check milestones
            milestones = [
                (100, NotificationType.GOAL_ACHIEVED, "Meta alcançada! 🎉", NotificationPriority.HIGH),
                (75, NotificationType.GOAL_MILESTONE_75, "75% da meta!", NotificationPriority.NORMAL),
                (50, NotificationType.GOAL_MILESTONE_50, "50% da meta!", NotificationPriority.NORMAL),
                (25, NotificationType.GOAL_MILESTONE_25, "25% da meta!", NotificationPriority.LOW),
            ]

            for threshold, notification_type, title, priority in milestones:
                if percentage >= threshold:
                    if not await self._notification_exists(
                        user.id, notification_type, "goal", goal.id
                    ):
                        message = (
                            f"Parabéns! Você alcançou a meta '{goal.name}'!"
                            if threshold == 100
                            else f"Você atingiu {threshold}% da meta '{goal.name}'. Continue assim!"
                        )
                        await self.notification_service.send_notification(
                            user_id=user.id,
                            notification_type=notification_type,
                            title=title,
                            message=message,
                            entity_type="goal",
                            entity_id=goal.id,
                            action_url=f"/goals/{goal.id}",
                            action_label="Ver meta",
                            priority=priority,
                            icon="target",
                            color="green",
                        )
                        count += 1
                    break  # Only send the highest milestone not yet sent

        return count

    async def check_low_balance(self, user: User) -> int:
        """Check for low account balances."""
        count = 0
        low_balance_threshold = Decimal("100")  # R$ 100

        query = select(Account).where(
            Account.user_id == user.id,
            Account.is_active == True,
            Account.type.in_(["checking", "wallet"]),  # Only check main accounts
        )
        result = await self.db.execute(query)
        accounts = result.scalars().all()

        for account in accounts:
            if account.balance < low_balance_threshold:
                if not await self._notification_exists_today(
                    user.id, NotificationType.BALANCE_LOW, "account", account.id
                ):
                    await self.notification_service.send_notification(
                        user_id=user.id,
                        notification_type=NotificationType.BALANCE_LOW,
                        title="Saldo baixo",
                        message=f"A conta '{account.name}' está com saldo de R$ {account.balance:.2f}.",
                        entity_type="account",
                        entity_id=account.id,
                        action_url="/accounts",
                        action_label="Ver contas",
                        priority=NotificationPriority.NORMAL if account.balance >= 0 else NotificationPriority.HIGH,
                        icon="alert-triangle",
                        color="orange" if account.balance >= 0 else "red",
                    )
                    count += 1

        return count

    async def check_recurring_due(self, user: User) -> int:
        """Check for recurring transactions due tomorrow."""
        tomorrow = date.today() + timedelta(days=1)
        count = 0

        query = select(RecurringTransaction).where(
            RecurringTransaction.user_id == user.id,
            RecurringTransaction.status == RecurringStatus.ACTIVE.value,
            RecurringTransaction.next_due_date == tomorrow,
        )
        result = await self.db.execute(query)
        recurrings = result.scalars().all()

        for recurring in recurrings:
            if not await self._notification_exists(
                user.id, NotificationType.RECURRING_DUE_TOMORROW, "recurring", recurring.id
            ):
                await self.notification_service.send_notification(
                    user_id=user.id,
                    notification_type=NotificationType.RECURRING_DUE_TOMORROW,
                    title="Lembrete: transação amanhã",
                    message=f"'{recurring.description}' de R$ {recurring.amount:.2f} vence amanhã.",
                    entity_type="recurring",
                    entity_id=recurring.id,
                    action_url="/recurring",
                    action_label="Ver recorrentes",
                    priority=NotificationPriority.NORMAL,
                    icon="calendar",
                    color="blue",
                )
                count += 1

        return count

    async def _notification_exists(
        self,
        user_id: int,
        notification_type: NotificationType,
        entity_type: str,
        entity_id: int,
    ) -> bool:
        """Check if a notification of this type already exists for the entity."""
        query = select(Notification).where(
            Notification.user_id == user_id,
            Notification.type == notification_type.value,
            Notification.entity_type == entity_type,
            Notification.entity_id == entity_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def _notification_exists_today(
        self,
        user_id: int,
        notification_type: NotificationType,
        entity_type: str,
        entity_id: int,
    ) -> bool:
        """Check if a notification was already sent today."""
        today_start = datetime.combine(date.today(), datetime.min.time())
        query = select(Notification).where(
            Notification.user_id == user_id,
            Notification.type == notification_type.value,
            Notification.entity_type == entity_type,
            Notification.entity_id == entity_id,
            Notification.created_at >= today_start,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None
