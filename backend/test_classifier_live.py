"""Script para testar classificador em ambiente local"""
import asyncio
from pathlib import Path
from app.modules.documents.services.llm_ocr_service import LLMOCRService
from app.modules.documents.services.document_classifier import DocumentClassifier

async def test_classifier():
    """Testa o classificador com textos de exemplo"""

    print("\n" + "="*60)
    print("TESTE DO DOCUMENT CLASSIFIER")
    print("="*60 + "\n")

    classifier = DocumentClassifier(use_llm_fallback=False)

    # Teste 1: Cupom fiscal claro
    print("📄 Teste 1: Cupom Fiscal com NFC-e")
    print("-" * 60)
    cupom_text = """
    CUPOM FISCAL ELETRONICO - NFC-e
    SUPER ADEGA LTDA
    CNPJ: 12.345.678/0001-90

    ITEM CODIGO DESCRICAO QTDE UN VL UNIT VL TOTAL
    001 10074 REFR COCA COLA 2L 1 UN 8.99 8.99
    002 20145 BANANA PRATA KG 1.5 KG 7.99 11.99

    Chave de Acesso: 12345678901234567890123456789012345678901234
    Protocolo: 123456789
    TOTAL: R$ 20,98
    """

    result = await classifier.classify(cupom_text)
    print(f"✅ Resultado: {result.value}")
    print(f"📊 Stats: {classifier.get_stats()}\n")

    # Teste 2: Fatura de cartão clara
    print("💳 Teste 2: Fatura de Cartão com Limite")
    print("-" * 60)
    fatura_text = """
    NUBANK - Nu Pagamentos S.A.
    Cartão final 1234
    Limite de Crédito: R$ 10.000,00
    Limite Disponível: R$ 8.500,00

    Fatura de Janeiro/2026
    Vencimento: 15/02/2026

    12 JAN IFOOD R$ 50,00
    15 JAN UBER 2/10 R$ 20,00
    20 JAN NETFLIX R$ 39,90

    Total a Pagar: R$ 109,90
    """

    result = await classifier.classify(fatura_text)
    print(f"✅ Resultado: {result.value}")
    print(f"📊 Stats: {classifier.get_stats()}\n")

    # Teste 3: Caso ambíguo (zona cinzenta)
    print("❓ Teste 3: Texto Ambíguo")
    print("-" * 60)
    ambiguous_text = """
    CARREFOUR
    CNPJ: 12.345.678/0001-90
    Total: R$ 100,00
    """

    result = await classifier.classify(ambiguous_text)
    print(f"✅ Resultado: {result.value}")
    print(f"📊 Stats: {classifier.get_stats()}\n")

    # Estatísticas finais
    print("="*60)
    print("ESTATÍSTICAS FINAIS")
    print("="*60)
    stats = classifier.get_stats()
    print(f"Total de documentos: {stats['total']}")
    print(f"Classificados por regras: {stats['by_rules']} ({stats['by_rules']/stats['total']*100:.1f}%)")
    print(f"Classificados por LLM: {stats['by_llm']} ({stats['by_llm']/stats['total']*100:.1f}%)")
    print(f"Não classificados: {stats['unknown']} ({stats['unknown']/stats['total']*100:.1f}%)")
    print("="*60 + "\n")


async def test_mistral_integration():
    """Testa integração com MistralProvider"""

    print("\n" + "="*60)
    print("TESTE DE INTEGRAÇÃO COM MISTRAL PROVIDER")
    print("="*60 + "\n")

    # Simular texto OCR de um cupom
    ocr_text = """
    NFC-e NUMERO: 123456
    CUPOM FISCAL ELETRONICO

    SUPERMERCADO ABC LTDA
    CNPJ: 12.345.678/0001-90

    ITEM CODIGO DESCRICAO QTDE
    001 12345 PRODUTO A 1
    002 67890 PRODUTO B 2

    TOTAL R$ 50,00
    """

    try:
        from app.modules.documents.services.providers.mistral_provider import MistralProvider

        provider = MistralProvider(use_classifier=True)

        print("📝 Texto OCR simulado:")
        print(ocr_text[:200] + "...")
        print()

        # Testar método _get_prompt
        prompt_text, doc_type = await provider._get_prompt(ocr_text)

        print(f"✅ Tipo detectado: {doc_type}")
        print(f"📄 Prompt selecionado: {len(prompt_text)} caracteres")
        print(f"🎯 Prompt começa com: {prompt_text[:100]}...")

        # Verificar se é o prompt focado
        if "GARANTIDAMENTE" in prompt_text:
            print("\n✅ Prompt FOCADO detectado!")
        else:
            print("\n⚠️  Prompt genérico detectado")

    except Exception as e:
        print(f"❌ Erro: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "="*60 + "\n")


if __name__ == "__main__":
    print("\n🚀 Iniciando testes do DocumentClassifier...\n")

    # Teste 1: Classificador standalone
    asyncio.run(test_classifier())

    # Teste 2: Integração com Mistral
    asyncio.run(test_mistral_integration())

    print("✅ Testes concluídos!\n")
