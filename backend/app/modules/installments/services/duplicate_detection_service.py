"""Serviço para detecção e resolução de duplicatas em séries de parcelas"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status

from app.models.installment import InstallmentSeries, InstallmentSeriesStatus
from app.models.transaction import Transaction
from app.models.user import User
from app.modules.installments.services.installment_service import InstallmentService
from app.modules.installments.schemas.duplicate import (
    DuplicateGroup,
    ConflictDetail,
)
from app.modules.installments.schemas.installment import InstallmentSeriesResponse


class DuplicateDetectionService:
    """Detecta e resolve duplicatas em séries de parcelas"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.installment_service = InstallmentService(db)

    async def find_duplicate_groups(
        self,
        user: User,
        min_similarity: float = 0.7
    ) -> list[DuplicateGroup]:
        """
        Detecta grupos de séries similares.

        Algoritmo:
        1. Busca todas séries ativas do usuário
        2. Para cada par, calcula similarity score
        3. Agrupa séries com score >= min_similarity
        4. Identifica conflitos (parcelas duplicadas)
        5. Ordena por probabilidade de ser duplicata
        """
        # Buscar todas séries ativas
        result = await self.db.execute(
            select(InstallmentSeries).where(
                and_(
                    InstallmentSeries.user_id == user.id,
                    InstallmentSeries.status == InstallmentSeriesStatus.ACTIVE,
                )
            ).order_by(InstallmentSeries.created_at.desc())
        )
        series_list = list(result.scalars().all())

        if len(series_list) < 2:
            return []

        # Encontrar pares duplicados
        duplicate_groups = []
        processed_ids = set()

        for i, series_a in enumerate(series_list):
            if series_a.id in processed_ids:
                continue

            for series_b in series_list[i + 1:]:
                if series_b.id in processed_ids:
                    continue

                # Calcular similaridade
                score = self._calculate_similarity_score(series_a, series_b)

                if score >= min_similarity:
                    # Encontrar conflitos
                    conflicts = await self._find_conflicts(series_a, series_b)

                    # Estimar excesso devido a duplicatas
                    estimated_excess = sum(
                        float(series_a.installment_amount)
                        for c in conflicts
                        if c.series_a_transaction_id and c.series_b_transaction_id
                    )

                    # Sugerir série primária (mais antiga)
                    suggested_primary_id = (
                        series_a.id if series_a.created_at < series_b.created_at
                        else series_b.id
                    )

                    duplicate_groups.append(DuplicateGroup(
                        series=[
                            InstallmentSeriesResponse.model_validate(series_a),
                            InstallmentSeriesResponse.model_validate(series_b),
                        ],
                        similarity_score=score,
                        conflicts=conflicts,
                        suggested_primary_id=suggested_primary_id,
                        estimated_excess=estimated_excess,
                    ))

                    # Marcar como processadas
                    processed_ids.add(series_a.id)
                    processed_ids.add(series_b.id)
                    break

        # Ordenar por score (maior primeiro)
        duplicate_groups.sort(key=lambda g: g.similarity_score, reverse=True)

        return duplicate_groups

    def _calculate_similarity_score(
        self,
        series_a: InstallmentSeries,
        series_b: InstallmentSeries
    ) -> float:
        """
        Calcula score de similaridade entre duas séries (0.0 a 1.0).

        Critérios:
        - Merchant name (fuzzy) - peso 40%
        - Valor parcela (tolerância 5%) - peso 30%
        - Total parcelas - peso 15%
        - Cartão crédito - peso 15%
        """
        score = 0.0

        # 1. Similaridade do nome (40%)
        if series_a.merchant_name and series_b.merchant_name:
            norm_a = self.installment_service._normalize_merchant_name(series_a.merchant_name)
            norm_b = self.installment_service._normalize_merchant_name(series_b.merchant_name)

            words_a = set(norm_a.split())
            words_b = set(norm_b.split())

            if words_a and words_b:
                common = words_a & words_b
                total = max(len(words_a), len(words_b))
                if total > 0:
                    name_score = len(common) / total
                    score += name_score * 0.4

        # 2. Similaridade do valor (30%)
        if series_a.installment_amount and series_b.installment_amount:
            amount_a = float(series_a.installment_amount)
            amount_b = float(series_b.installment_amount)
            tolerance = 0.05  # 5%

            if amount_a > 0:
                diff = abs(amount_a - amount_b) / amount_a
                if diff <= tolerance:
                    amount_score = 1.0 - (diff / tolerance)
                    score += amount_score * 0.3

        # 3. Mesmo total de parcelas (15%)
        if series_a.installment_count == series_b.installment_count:
            score += 0.15

        # 4. Mesmo cartão de crédito (15%)
        if series_a.credit_card_id and series_b.credit_card_id:
            if series_a.credit_card_id == series_b.credit_card_id:
                score += 0.15
        elif not series_a.credit_card_id and not series_b.credit_card_id:
            # Ambos sem cartão (débito)
            score += 0.15

        return score

    async def _find_conflicts(
        self,
        series_a: InstallmentSeries,
        series_b: InstallmentSeries
    ) -> list[ConflictDetail]:
        """
        Encontra conflitos entre duas séries (parcelas duplicadas).

        Conflito = ambas séries têm transação para a mesma parcela N/M.
        """
        # Buscar transações de ambas séries
        result_a = await self.db.execute(
            select(Transaction).where(
                Transaction.installment_series_id == series_a.id
            )
        )
        transactions_a = {t.installment_number: t for t in result_a.scalars().all()}

        result_b = await self.db.execute(
            select(Transaction).where(
                Transaction.installment_series_id == series_b.id
            )
        )
        transactions_b = {t.installment_number: t for t in result_b.scalars().all()}

        # Encontrar parcelas que existem em ambas
        conflicts = []
        common_numbers = set(transactions_a.keys()) & set(transactions_b.keys())

        for num in sorted(common_numbers):
            tx_a = transactions_a[num]
            tx_b = transactions_b[num]

            conflicts.append(ConflictDetail(
                installment_number=num,
                series_a_transaction_id=tx_a.id,
                series_a_date=tx_a.date,
                series_b_transaction_id=tx_b.id,
                series_b_date=tx_b.date,
                description=f"Parcela {num}/{series_a.installment_count} existe em ambas as séries"
            ))

        return conflicts

    async def merge_series(
        self,
        user: User,
        source_id: int,
        target_id: int,
        conflict_resolution: str = "keep_oldest",
        new_merchant_name: str | None = None
    ) -> InstallmentSeries:
        """
        Mescla duas séries.

        Operações em transação:
        1. Verifica conflitos (parcelas duplicadas)
        2. Resolve conflitos conforme estratégia
        3. Move transações de source para target
        4. Atualiza merchant_name se fornecido
        5. Marca source como MERGED
        6. Recalcula totalizadores
        """
        # Buscar séries
        source = await self._get_series(user, source_id)
        target = await self._get_series(user, target_id)

        if not source or not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Série não encontrada"
            )

        # Verificar conflitos
        conflicts = await self._find_conflicts(source, target)

        # Buscar todas transações da source
        result = await self.db.execute(
            select(Transaction).where(
                Transaction.installment_series_id == source_id
            )
        )
        source_transactions = list(result.scalars().all())

        # Processar conflitos
        for conflict in conflicts:
            if conflict_resolution == "keep_oldest":
                # Manter a mais antiga, deletar a mais recente
                tx_a_date = conflict.series_a_date
                tx_b_date = conflict.series_b_date

                if tx_a_date and tx_b_date:
                    if tx_a_date < tx_b_date:
                        # A é mais antiga, deletar B
                        tx_to_delete = next(
                            (t for t in source_transactions
                             if t.id == conflict.series_b_transaction_id),
                            None
                        )
                    else:
                        # B é mais antiga, deletar A da target
                        result_del = await self.db.execute(
                            select(Transaction).where(
                                Transaction.id == conflict.series_a_transaction_id
                            )
                        )
                        tx_to_delete = result_del.scalar_one_or_none()

                    if tx_to_delete:
                        await self.db.delete(tx_to_delete)
                        # Remover da lista se for de source
                        if tx_to_delete in source_transactions:
                            source_transactions.remove(tx_to_delete)

            elif conflict_resolution == "keep_newest":
                # Inverso do keep_oldest
                tx_a_date = conflict.series_a_date
                tx_b_date = conflict.series_b_date

                if tx_a_date and tx_b_date:
                    if tx_a_date > tx_b_date:
                        # A é mais recente, deletar B
                        tx_to_delete = next(
                            (t for t in source_transactions
                             if t.id == conflict.series_b_transaction_id),
                            None
                        )
                    else:
                        # B é mais recente, deletar A da target
                        result_del = await self.db.execute(
                            select(Transaction).where(
                                Transaction.id == conflict.series_a_transaction_id
                            )
                        )
                        tx_to_delete = result_del.scalar_one_or_none()

                    if tx_to_delete:
                        await self.db.delete(tx_to_delete)
                        if tx_to_delete in source_transactions:
                            source_transactions.remove(tx_to_delete)

            # keep_both: não deletar nada (manter ambas)

        # Mover transações restantes de source para target
        for tx in source_transactions:
            tx.installment_series_id = target_id

        # Atualizar merchant_name se fornecido
        if new_merchant_name:
            target.merchant_name = new_merchant_name
            target.description = new_merchant_name

        # Marcar source como MERGED
        source.status = InstallmentSeriesStatus.COMPLETED

        # Recalcular paid_count da target
        result_target = await self.db.execute(
            select(Transaction).where(
                and_(
                    Transaction.installment_series_id == target_id,
                    Transaction.is_paid == True
                )
            )
        )
        target.paid_count = len(list(result_target.scalars().all()))

        # Verificar se target está completa
        if target.paid_count >= target.installment_count:
            target.status = InstallmentSeriesStatus.COMPLETED

        await self.db.flush()
        await self.db.refresh(target)

        return target

    async def _get_series(self, user: User, series_id: int) -> InstallmentSeries | None:
        """Busca série do usuário"""
        result = await self.db.execute(
            select(InstallmentSeries).where(
                and_(
                    InstallmentSeries.id == series_id,
                    InstallmentSeries.user_id == user.id,
                )
            )
        )
        return result.scalar_one_or_none()
