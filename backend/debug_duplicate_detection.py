"""Script de debug para verificar detecção de duplicatas"""
import asyncio
from decimal import Decimal
from sqlalchemy import select
from app.core.database import async_session_maker
from app.models.installment import InstallmentSeries
from app.modules.installments.services.duplicate_detection_service import DuplicateDetectionService


async def debug_series_comparison():
    """Debug da comparação de séries 427 e 429"""
    async with async_session_maker() as db:
        # Buscar séries
        result = await db.execute(
            select(InstallmentSeries).where(
                InstallmentSeries.id.in_([427, 429])
            )
        )
        series_list = list(result.scalars().all())

        if len(series_list) != 2:
            print(f"❌ Erro: Esperava 2 séries, encontrou {len(series_list)}")
            return

        series_a = series_list[0]
        series_b = series_list[1]

        print("\n" + "="*80)
        print("DEBUG: COMPARAÇÃO DE SÉRIES DE DUPLICATAS")
        print("="*80)

        print(f"\n📊 SÉRIE A (ID: {series_a.id})")
        print(f"   Merchant Name: {series_a.merchant_name}")
        print(f"   Installment Amount: {series_a.installment_amount} (type: {type(series_a.installment_amount)})")
        print(f"   Installment Count: {series_a.installment_count}")
        print(f"   Credit Card ID: {series_a.credit_card_id}")
        print(f"   Status: {series_a.status}")

        print(f"\n📊 SÉRIE B (ID: {series_b.id})")
        print(f"   Merchant Name: {series_b.merchant_name}")
        print(f"   Installment Amount: {series_b.installment_amount} (type: {type(series_b.installment_amount)})")
        print(f"   Installment Count: {series_b.installment_count}")
        print(f"   Credit Card ID: {series_b.credit_card_id}")
        print(f"   Status: {series_b.status}")

        # Verificar Hard Rules
        print(f"\n{'='*80}")
        print("VERIFICAÇÃO DAS HARD RULES")
        print("="*80)

        # Hard Rule 1: Amount Difference
        if series_a.installment_amount and series_b.installment_amount:
            amount_a = float(series_a.installment_amount)
            amount_b = float(series_b.installment_amount)
            diff_absolute = abs(amount_a - amount_b)

            print(f"\n✅ HARD RULE 1: Diferença Absoluta de Valor")
            print(f"   Valor A: R$ {amount_a:.2f}")
            print(f"   Valor B: R$ {amount_b:.2f}")
            print(f"   Diferença Absoluta: R$ {diff_absolute:.2f}")
            print(f"   Threshold: R$ 0.05")
            print(f"   Bloqueado: {'SIM ❌' if diff_absolute > 0.05 else 'NÃO ✅'}")

            if diff_absolute > 0.05:
                print(f"\n   ⚠️  DEVERIA RETORNAR SCORE 0.0 E PARAR AQUI!")
        else:
            print(f"\n❌ HARD RULE 1: IGNORADA (valores None)")
            print(f"   Valor A: {series_a.installment_amount}")
            print(f"   Valor B: {series_b.installment_amount}")

        # Hard Rule 2: Name Overlap
        if series_a.merchant_name and series_b.merchant_name:
            # Simular normalização (simplificado)
            words_a = set(series_a.merchant_name.lower().split())
            words_b = set(series_b.merchant_name.lower().split())

            if words_a and words_b:
                common = words_a & words_b
                total = max(len(words_a), len(words_b))
                name_overlap = len(common) / total if total > 0 else 0

                print(f"\n✅ HARD RULE 2: Sobreposição de Nome")
                print(f"   Nome A: {series_a.merchant_name}")
                print(f"   Nome B: {series_b.merchant_name}")
                print(f"   Palavras A: {words_a}")
                print(f"   Palavras B: {words_b}")
                print(f"   Palavras comuns: {common}")
                print(f"   Overlap: {name_overlap:.2%}")
                print(f"   Threshold: 80%")
                print(f"   Bloqueado: {'SIM ❌' if name_overlap < 0.80 else 'NÃO ✅'}")

                if name_overlap < 0.80:
                    print(f"\n   ⚠️  DEVERIA RETORNAR SCORE 0.0 E PARAR AQUI!")
        else:
            print(f"\n❌ HARD RULE 2: IGNORADA (nomes None)")

        # Hard Rule 3: Installment Count
        print(f"\n✅ HARD RULE 3: Total de Parcelas")
        print(f"   Parcelas A: {series_a.installment_count}")
        print(f"   Parcelas B: {series_b.installment_count}")
        print(f"   Bloqueado: {'SIM ❌' if series_a.installment_count != series_b.installment_count else 'NÃO ✅'}")

        if series_a.installment_count != series_b.installment_count:
            print(f"\n   ⚠️  DEVERIA RETORNAR SCORE 0.0 E PARAR AQUI!")

        # Calcular score usando o serviço
        print(f"\n{'='*80}")
        print("CÁLCULO DE SCORE REAL")
        print("="*80)

        service = DuplicateDetectionService(db)
        score = service._calculate_similarity_score(series_a, series_b)

        print(f"\n📈 Score calculado: {score:.4f} ({score * 100:.2f}%)")

        if score == 0.0:
            print("✅ CORRETO: Score é 0.0 (bloqueado pelas hard rules)")
        elif score >= 0.70:
            print("❌ ERRO: Score alto detectado! As hard rules não estão funcionando!")
            print("   Possíveis causas:")
            print("   1. Servidor não foi reiniciado após as mudanças")
            print("   2. Cache do Python (.pyc) não foi limpo")
            print("   3. Valores de installment_amount estão None/vazios")
        else:
            print(f"⚠️  ATENÇÃO: Score baixo ({score:.2f}) mas não zero")

        print(f"\n{'='*80}")
        print("CONCLUSÃO")
        print("="*80)

        if score > 0.0 and series_a.installment_amount and series_b.installment_amount:
            diff = abs(float(series_a.installment_amount) - float(series_b.installment_amount))
            if diff > 0.05:
                print("\n🚨 PROBLEMA DETECTADO!")
                print(f"   Diferença de valores: R$ {diff:.2f}")
                print(f"   Score retornado: {score:.4f}")
                print(f"   ❌ DEVERIA SER: 0.0")
                print("\n🔧 SOLUÇÃO:")
                print("   1. Reinicie o servidor FastAPI")
                print("   2. Limpe o cache: rm -rf backend/**/__pycache__")
                print("   3. Teste novamente")


if __name__ == "__main__":
    asyncio.run(debug_series_comparison())
