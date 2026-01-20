#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pathlib import Path
import pillow_heif
from PIL import Image
import io

async def main():
    pillow_heif.register_heif_opener()

    # Aceita diretório como argumento ou usa cupom_teste como padrão
    dir_name = sys.argv[1] if len(sys.argv) > 1 else "cupom_teste"
    heic_dir = Path(__file__).parent.parent / dir_name
    print(f"Diretório: {heic_dir}")

    # Suporta .heic e .jpg/.jpeg
    heic_files = sorted(list(heic_dir.glob("*.heic")) + list(heic_dir.glob("*.jpg")) + list(heic_dir.glob("*.jpeg")))

    images = []
    for heic_file in heic_files:
        print(f"Loading: {heic_file.name}")
        with open(heic_file, 'rb') as f:
            heic_content = f.read()
        img = Image.open(io.BytesIO(heic_content))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=85)
        images.append((output.getvalue(), 'image/jpeg'))

    print(f"\n{len(images)} imagens convertidas\n")

    from app.modules.documents.services.llm_ocr_service import LLMOCRService
    from app.core.config import settings
    # Usar Mistral
    provider = 'mistral'
    print(f"Usando provider: {provider}")
    llm_service = LLMOCRService(provider=provider)

    print("Extraindo itens...")
    result = await llm_service.extract_from_multiple_images(images)

    if result.get('error'):
        print(f"\nErro: {result['error']}")
        return

    items = result.get('items', [])
    total = sum(item.get('amount', 0) for item in items)

    print(f"\n{'='*70}")
    for i, item in enumerate(items, 1):
        desc = item.get('description', 'N/A')[:40]
        amount = item.get('amount', 0)
        print(f"{i:3}. {desc:40} R$ {amount:>8.2f}")
    print(f"{'='*70}")
    print(f"TOTAL ITENS: {len(items)}")
    print(f"TOTAL VALOR: R$ {total:.2f}")

    # Verificar payment_info
    payment_info = result.get('payment_info')
    if payment_info:
        print(f"\nPAYMENT INFO:")
        print(f"  Total: R$ {payment_info.get('total', 0):.2f}")
        print(f"  Subtotal: R$ {payment_info.get('subtotal', 0):.2f}")
        print(f"  Desconto: R$ {payment_info.get('discount', 0):.2f}")
        payments = payment_info.get('payments', [])
        for p in payments:
            print(f"  Pagamento: {p.get('method')} - R$ {p.get('amount', 0):.2f}")

    # Diferença
    expected = 1225.23
    diff = expected - total
    print(f"\nDIFERENÇA: R$ {diff:.2f} (esperado: R$ {expected:.2f})")

if __name__ == "__main__":
    asyncio.run(main())
