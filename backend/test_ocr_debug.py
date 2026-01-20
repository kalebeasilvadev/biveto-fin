#!/usr/bin/env python3
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pathlib import Path
import pillow_heif
from PIL import Image
import io
from mistralai import Mistral
from app.core.config import settings

async def main():
    pillow_heif.register_heif_opener()

    heic_dir = Path(__file__).parent.parent / "cupom_teste"
    heic_files = sorted(heic_dir.glob("*.heic"))

    # Converter imagens para PDF com alta qualidade
    print("Convertendo imagens para PDF...")
    pdf_images = []
    for heic_file in heic_files:
        print(f"  {heic_file.name}")
        with open(heic_file, 'rb') as f:
            heic_content = f.read()
        img = Image.open(io.BytesIO(heic_content))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        pdf_images.append(img)

    output = io.BytesIO()
    pdf_images[0].save(output, format='PDF', save_all=True, append_images=pdf_images[1:], resolution=150)
    pdf_content = output.getvalue()
    print(f"\nPDF gerado: {len(pdf_content)} bytes")

    # Mistral OCR
    client = Mistral(api_key=settings.mistral_api_key)

    print("\nUpload do PDF...")
    uploaded_file = client.files.upload(
        file={"file_name": "cupom.pdf", "content": pdf_content},
        purpose="ocr"
    )

    print(f"OCR em andamento...")
    ocr_response = client.ocr.process(
        model=settings.mistral_ocr_model,
        document={"type": "file", "file_id": uploaded_file.id},
        include_image_base64=False
    )

    # Extrair texto
    ocr_text = ""
    if hasattr(ocr_response, 'pages'):
        print(f"\nTotal de páginas: {len(ocr_response.pages)}")
        for i, page in enumerate(ocr_response.pages):
            page_text = page.markdown if hasattr(page, 'markdown') else ""
            print(f"  Página {i+1}: {len(page_text)} caracteres")
            ocr_text += page_text + "\n\n"

    print(f"\n{'='*70}")
    print(f"TEXTO TOTAL DO OCR: {len(ocr_text)} caracteres")
    print(f"{'='*70}")
    print(ocr_text)

if __name__ == "__main__":
    asyncio.run(main())
