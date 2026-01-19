"""
Envelope Service.

Handles CRUD operations and business logic for envelope budgeting.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    User, Category,
    SpendingEnvelope, EnvelopeHistory,
    EnvelopePeriodType, EnvelopeStatus,
    EnvelopeRefillSchedule, EnvelopeChangeType,
)
from app.modules.envelopes.schemas import (
    EnvelopeCreate, EnvelopeUpdate, EnvelopeResponse,
    EnvelopeSummary, DailyAllowance, EnvelopeTransfer,
    EnvelopeHistoryResponse,
)
from app.modules.household.utils import (
    get_household_user_ids,
    get_household_member,
    build_ownership_filter,
    validate_create_permission,
    validate_edit_permission,
    validate_delete_permission,
)


class EnvelopeService:
    """Service for envelope budgeting operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user: User, data: EnvelopeCreate) -> SpendingEnvelope:
        """Create a new spending envelope."""
        # Validate permissions
        await validate_create_permission(self.db, user, data.ownership_type)

        # Validate category if provided
        if data.category_id:
            category = await self.db.scalar(
                select(Category).where(
                    Category.id == data.category_id,
                    Category.user_id == user.id
                )
            )
            if not category:
                raise ValueError("Categoria não encontrada")

        # Calculate period dates
        period_start, period_end = self._calculate_period_dates(
            data.period_type, data.refill_schedule, data.custom_refill_day
        )

        envelope = SpendingEnvelope(
            user_id=user.id,
            category_id=data.category_id,
            name=data.name,
            description=data.description,
            period_type=data.period_type.value,
            limit_amount=data.limit_amount,
            current_balance=data.limit_amount,  # Start with full balance
            period_start_date=period_start,
            period_end_date=period_end,
            allow_rollover=data.allow_rollover,
            max_rollover_amount=data.max_rollover_amount,
            refill_schedule=data.refill_schedule.value,
            custom_refill_day=data.custom_refill_day,
            auto_refill=data.auto_refill,
            priority=data.priority,
            color=data.color,
            icon=data.icon,
            ownership_type=data.ownership_type,
        )

        self.db.add(envelope)
        await self.db.commit()
        await self.db.refresh(envelope)

        # Record initial refill in history
        await self._record_history(
            envelope,
            EnvelopeChangeType.REFILL,
            data.limit_amount,
            Decimal(0),
            data.limit_amount,
            notes="Criação do envelope"
        )

        return envelope

    async def list(
        self, user: User, include_inactive: bool = False
    ) -> list[EnvelopeResponse]:
        """List all envelopes for the user."""
        household_ids = await get_household_user_ids(self.db, user)
        member = await get_household_member(self.db, user)

        ownership_filter = build_ownership_filter(
            SpendingEnvelope,
            SpendingEnvelope.user_id,
            SpendingEnvelope.ownership_type,
            user.id,
            household_ids,
            member
        )

        query = (
            select(SpendingEnvelope)
            .options(selectinload(SpendingEnvelope.category))
            .where(ownership_filter)
            .order_by(SpendingEnvelope.priority.desc(), SpendingEnvelope.name)
        )

        if not include_inactive:
            query = query.where(SpendingEnvelope.is_active == True)

        result = await self.db.execute(query)
        envelopes = result.scalars().all()

        return [self._to_response(e) for e in envelopes]

    async def get_by_id(self, user: User, envelope_id: int) -> SpendingEnvelope | None:
        """Get envelope by ID."""
        query = (
            select(SpendingEnvelope)
            .options(selectinload(SpendingEnvelope.category))
            .where(
                SpendingEnvelope.id == envelope_id,
                SpendingEnvelope.user_id == user.id
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def update(
        self, user: User, envelope_id: int, data: EnvelopeUpdate
    ) -> SpendingEnvelope | None:
        """Update an envelope."""
        envelope = await self.get_by_id(user, envelope_id)
        if not envelope:
            return None

        await validate_edit_permission(
            self.db, user, envelope.user_id, envelope.ownership_type
        )

        update_data = data.model_dump(exclude_unset=True)

        # Validate category if changed
        if "category_id" in update_data and update_data["category_id"]:
            category = await self.db.scalar(
                select(Category).where(
                    Category.id == update_data["category_id"],
                    Category.user_id == user.id
                )
            )
            if not category:
                raise ValueError("Categoria não encontrada")

        # Handle period type change
        recalculate_period = False
        if "period_type" in update_data or "refill_schedule" in update_data or "custom_refill_day" in update_data:
            recalculate_period = True

        for field, value in update_data.items():
            if field == "period_type" and value:
                setattr(envelope, field, value.value)
            elif field == "refill_schedule" and value:
                setattr(envelope, field, value.value)
            else:
                setattr(envelope, field, value)

        if recalculate_period:
            period_start, period_end = self._calculate_period_dates(
                EnvelopePeriodType(envelope.period_type),
                EnvelopeRefillSchedule(envelope.refill_schedule),
                envelope.custom_refill_day
            )
            envelope.period_start_date = period_start
            envelope.period_end_date = period_end

        # Update status based on balance
        envelope.status = self._calculate_status(envelope)

        await self.db.commit()
        await self.db.refresh(envelope)
        return envelope

    async def delete(self, user: User, envelope_id: int) -> bool:
        """Delete an envelope."""
        envelope = await self.get_by_id(user, envelope_id)
        if not envelope:
            return False

        await validate_delete_permission(
            self.db, user, envelope.user_id, envelope.ownership_type
        )

        await self.db.delete(envelope)
        await self.db.commit()
        return True

    async def spend_from_envelope(
        self,
        envelope: SpendingEnvelope,
        amount: Decimal,
        transaction_id: int | None = None,
        notes: str | None = None,
    ) -> None:
        """Record spending from an envelope."""
        balance_before = envelope.current_balance
        envelope.current_balance -= amount
        balance_after = envelope.current_balance

        envelope.status = self._calculate_status(envelope)

        await self._record_history(
            envelope,
            EnvelopeChangeType.SPEND,
            amount,
            balance_before,
            balance_after,
            transaction_id=transaction_id,
            notes=notes
        )

        await self.db.commit()

    async def refund_to_envelope(
        self,
        envelope: SpendingEnvelope,
        amount: Decimal,
        transaction_id: int | None = None,
        notes: str | None = None,
    ) -> None:
        """Record a refund back to an envelope."""
        balance_before = envelope.current_balance
        envelope.current_balance += amount
        balance_after = envelope.current_balance

        envelope.status = self._calculate_status(envelope)

        await self._record_history(
            envelope,
            EnvelopeChangeType.REFUND,
            amount,
            balance_before,
            balance_after,
            transaction_id=transaction_id,
            notes=notes
        )

        await self.db.commit()

    async def refill_envelope(
        self, envelope: SpendingEnvelope, process_rollover: bool = True
    ) -> Decimal:
        """Refill an envelope for a new period."""
        balance_before = envelope.current_balance

        # Process rollover
        rollover_amount = Decimal(0)
        if process_rollover and envelope.allow_rollover and envelope.current_balance > 0:
            rollover_amount = envelope.current_balance
            if envelope.max_rollover_amount:
                rollover_amount = min(rollover_amount, envelope.max_rollover_amount)

            if rollover_amount > 0:
                await self._record_history(
                    envelope,
                    EnvelopeChangeType.ROLLOVER,
                    rollover_amount,
                    balance_before,
                    rollover_amount,
                    notes=f"Rollover do período anterior"
                )

        # Reset balance
        envelope.rollover_balance = rollover_amount
        envelope.current_balance = envelope.limit_amount + rollover_amount
        balance_after = envelope.current_balance

        # Update period dates
        period_start, period_end = self._calculate_period_dates(
            EnvelopePeriodType(envelope.period_type),
            EnvelopeRefillSchedule(envelope.refill_schedule),
            envelope.custom_refill_day
        )
        envelope.period_start_date = period_start
        envelope.period_end_date = period_end

        envelope.status = EnvelopeStatus.AVAILABLE.value

        await self._record_history(
            envelope,
            EnvelopeChangeType.REFILL,
            envelope.limit_amount,
            rollover_amount,
            balance_after,
            notes="Recarga automática"
        )

        await self.db.commit()
        return balance_after

    async def transfer_between_envelopes(
        self, user: User, transfer: EnvelopeTransfer
    ) -> tuple[SpendingEnvelope, SpendingEnvelope]:
        """Transfer funds between two envelopes."""
        from_envelope = await self.get_by_id(user, transfer.from_envelope_id)
        to_envelope = await self.get_by_id(user, transfer.to_envelope_id)

        if not from_envelope or not to_envelope:
            raise ValueError("Envelope não encontrado")

        if from_envelope.current_balance < transfer.amount:
            raise ValueError("Saldo insuficiente no envelope de origem")

        # Debit from source
        from_balance_before = from_envelope.current_balance
        from_envelope.current_balance -= transfer.amount
        from_envelope.status = self._calculate_status(from_envelope)

        await self._record_history(
            from_envelope,
            EnvelopeChangeType.TRANSFER,
            -transfer.amount,
            from_balance_before,
            from_envelope.current_balance,
            notes=f"Transferência para {to_envelope.name}"
        )

        # Credit to destination
        to_balance_before = to_envelope.current_balance
        to_envelope.current_balance += transfer.amount
        to_envelope.status = self._calculate_status(to_envelope)

        await self._record_history(
            to_envelope,
            EnvelopeChangeType.TRANSFER,
            transfer.amount,
            to_balance_before,
            to_envelope.current_balance,
            notes=f"Transferência de {from_envelope.name}"
        )

        await self.db.commit()
        return from_envelope, to_envelope

    async def get_daily_allowance(
        self, user: User, envelope_id: int
    ) -> DailyAllowance:
        """Get daily spending allowance for an envelope."""
        envelope = await self.get_by_id(user, envelope_id)
        if not envelope:
            raise ValueError("Envelope não encontrado")

        remaining_days = max(1, (envelope.period_end_date - date.today()).days)
        daily = float(envelope.current_balance / remaining_days)
        weekly = daily * 7

        return DailyAllowance(
            envelope_id=envelope.id,
            envelope_name=envelope.name,
            current_balance=float(envelope.current_balance),
            remaining_days=remaining_days,
            daily_allowance=round(daily, 2),
            weekly_allowance=round(weekly, 2),
            period_end_date=envelope.period_end_date,
        )

    async def get_summary(self, user: User) -> EnvelopeSummary:
        """Get summary of all envelopes."""
        household_ids = await get_household_user_ids(self.db, user)

        query = select(SpendingEnvelope).where(
            SpendingEnvelope.user_id.in_(household_ids),
            SpendingEnvelope.is_active == True,
        )
        result = await self.db.execute(query)
        envelopes = result.scalars().all()

        total_budgeted = sum(float(e.limit_amount) for e in envelopes)
        total_remaining = sum(float(e.current_balance) for e in envelopes)
        total_spent = total_budgeted - total_remaining

        overspent_count = sum(1 for e in envelopes if e.status == EnvelopeStatus.OVERSPENT.value)
        depleted_count = sum(1 for e in envelopes if e.status == EnvelopeStatus.DEPLETED.value)

        return EnvelopeSummary(
            total_envelopes=len(envelopes),
            active_envelopes=len([e for e in envelopes if e.is_active]),
            total_budgeted=total_budgeted,
            total_spent=total_spent,
            total_remaining=total_remaining,
            overspent_count=overspent_count,
            depleted_count=depleted_count,
        )

    async def get_history(
        self, user: User, envelope_id: int, limit: int = 50
    ) -> list[EnvelopeHistoryResponse]:
        """Get history for an envelope."""
        envelope = await self.get_by_id(user, envelope_id)
        if not envelope:
            raise ValueError("Envelope não encontrado")

        query = (
            select(EnvelopeHistory)
            .where(EnvelopeHistory.envelope_id == envelope_id)
            .order_by(EnvelopeHistory.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        history = result.scalars().all()

        return [
            EnvelopeHistoryResponse(
                id=h.id,
                envelope_id=h.envelope_id,
                transaction_id=h.transaction_id,
                change_type=h.change_type,
                amount=float(h.amount),
                balance_before=float(h.balance_before),
                balance_after=float(h.balance_after),
                period_start=h.period_start,
                period_end=h.period_end,
                notes=h.notes,
                created_at=h.created_at,
            )
            for h in history
        ]

    async def find_by_category(
        self, user: User, category_id: int
    ) -> SpendingEnvelope | None:
        """Find an active envelope for a specific category."""
        query = (
            select(SpendingEnvelope)
            .where(
                SpendingEnvelope.user_id == user.id,
                SpendingEnvelope.category_id == category_id,
                SpendingEnvelope.is_active == True,
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def process_pending_refills(self) -> int:
        """Process pending refills for all envelopes. Called by background task."""
        today = date.today()

        query = select(SpendingEnvelope).where(
            SpendingEnvelope.is_active == True,
            SpendingEnvelope.auto_refill == True,
            SpendingEnvelope.period_end_date < today,
        )
        result = await self.db.execute(query)
        envelopes = result.scalars().all()

        count = 0
        for envelope in envelopes:
            await self.refill_envelope(envelope)
            count += 1

        return count

    def _calculate_period_dates(
        self,
        period_type: EnvelopePeriodType,
        refill_schedule: EnvelopeRefillSchedule,
        custom_day: int | None,
    ) -> tuple[date, date]:
        """Calculate period start and end dates."""
        today = date.today()

        if period_type == EnvelopePeriodType.DAILY:
            return today, today

        if period_type == EnvelopePeriodType.WEEKLY:
            # Start on Monday
            start = today - timedelta(days=today.weekday())
            end = start + timedelta(days=6)
            return start, end

        if period_type == EnvelopePeriodType.BIWEEKLY:
            # Start on 1st or 15th
            if today.day < 15:
                start = today.replace(day=1)
                end = today.replace(day=14)
            else:
                start = today.replace(day=15)
                # End of month
                next_month = today.replace(day=28) + timedelta(days=4)
                end = next_month - timedelta(days=next_month.day)
            return start, end

        # Monthly
        if refill_schedule == EnvelopeRefillSchedule.MONTHLY_LAST:
            next_month = today.replace(day=28) + timedelta(days=4)
            end = next_month - timedelta(days=next_month.day)
            start = end.replace(day=1)
        elif refill_schedule == EnvelopeRefillSchedule.CUSTOM and custom_day:
            if today.day >= custom_day:
                start = today.replace(day=custom_day)
                next_month = start + relativedelta(months=1)
                end = next_month - timedelta(days=1)
            else:
                prev_month = today - relativedelta(months=1)
                start = prev_month.replace(day=min(custom_day, 28))
                end = today.replace(day=custom_day) - timedelta(days=1)
        else:
            # Default: 1st of month
            start = today.replace(day=1)
            next_month = start + relativedelta(months=1)
            end = next_month - timedelta(days=1)

        return start, end

    def _calculate_status(self, envelope: SpendingEnvelope) -> str:
        """Calculate envelope status based on balance."""
        if envelope.current_balance < 0:
            return EnvelopeStatus.OVERSPENT.value
        if envelope.current_balance == 0:
            return EnvelopeStatus.DEPLETED.value
        return EnvelopeStatus.AVAILABLE.value

    async def _record_history(
        self,
        envelope: SpendingEnvelope,
        change_type: EnvelopeChangeType,
        amount: Decimal,
        balance_before: Decimal,
        balance_after: Decimal,
        transaction_id: int | None = None,
        notes: str | None = None,
    ) -> EnvelopeHistory:
        """Record a change in envelope history."""
        history = EnvelopeHistory(
            envelope_id=envelope.id,
            transaction_id=transaction_id,
            change_type=change_type.value,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            period_start=envelope.period_start_date,
            period_end=envelope.period_end_date,
            notes=notes,
        )
        self.db.add(history)
        return history

    def _to_response(self, envelope: SpendingEnvelope) -> EnvelopeResponse:
        """Convert envelope model to response."""
        return EnvelopeResponse(
            id=envelope.id,
            name=envelope.name,
            description=envelope.description,
            category_id=envelope.category_id,
            category_name=envelope.category.name if envelope.category else None,
            period_type=envelope.period_type,
            limit_amount=float(envelope.limit_amount),
            current_balance=float(envelope.current_balance),
            period_start_date=envelope.period_start_date,
            period_end_date=envelope.period_end_date,
            allow_rollover=envelope.allow_rollover,
            max_rollover_amount=float(envelope.max_rollover_amount) if envelope.max_rollover_amount else None,
            rollover_balance=float(envelope.rollover_balance),
            refill_schedule=envelope.refill_schedule,
            custom_refill_day=envelope.custom_refill_day,
            auto_refill=envelope.auto_refill,
            status=envelope.status,
            priority=envelope.priority,
            color=envelope.color,
            icon=envelope.icon,
            is_active=envelope.is_active,
            ownership_type=envelope.ownership_type,
            spent_amount=float(envelope.spent_amount),
            spent_percentage=envelope.spent_percentage,
            remaining_days=envelope.remaining_days,
            daily_allowance=float(envelope.daily_allowance),
            created_at=envelope.created_at,
            updated_at=envelope.updated_at,
        )
