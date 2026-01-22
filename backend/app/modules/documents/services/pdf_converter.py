"""Conversor de PDF para imagens"""
import asyncio


def convert_pdf_to_images_sync(pdf_content: bytes) -> tuple[list[tuple[bytes, str]], str | None]:
    """Converte PDF para lista de imagens (uma por pagina) - SINCRONO

    Returns:
        Tuple of (images list, error message or None)
    """
    try:
        import fitz  # pymupdf

        images = []
        pdf_doc = fitz.open(stream=pdf_content, filetype="pdf")

        if len(pdf_doc) == 0:
            pdf_doc.close()
            return [], "PDF nao contem paginas"

        for page_num in range(len(pdf_doc)):
            page = pdf_doc[page_num]
            # Renderizar pagina como imagem com boa resolucao
            mat = fitz.Matrix(1.5, 1.5)  # 1.5x zoom - boa qualidade para OCR com menor uso de memória
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
            images.append((img_bytes, 'image/png'))

            # Liberar memória da página imediatamente após processá-la
            del pix
            del page

        pdf_doc.close()
        return images, None

    except ImportError as e:
        return [], f"PyMuPDF nao instalado: {e}"
    except Exception as e:
        return [], f"Erro ao converter PDF: {e}"


async def convert_pdf_to_images(pdf_content: bytes) -> tuple[list[tuple[bytes, str]], str | None]:
    """Converte PDF para lista de imagens (uma por pagina) - ASYNC wrapper

    Executa em thread separada para nao bloquear o event loop.
    """
    return await asyncio.to_thread(convert_pdf_to_images_sync, pdf_content)
