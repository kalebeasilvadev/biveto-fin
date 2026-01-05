import hashlib
import os
from datetime import datetime
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status, UploadFile

from ..models.document import Document, DocumentExtraction, DocumentStatus
from ..models.user import User
from ..core.config import settings


class DocumentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def upload(self, user: User, file: UploadFile) -> Document:
        # Validar extensão
        ext = file.filename.split(".")[-1].lower() if file.filename else ""
        if ext not in settings.allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Extensão não permitida. Use: {', '.join(settings.allowed_extensions)}",
            )

        # Ler conteúdo
        content = await file.read()

        # Validar tamanho
        if len(content) > settings.max_upload_size_mb * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Arquivo muito grande. Máximo: {settings.max_upload_size_mb}MB",
            )

        # Calcular hash para dedupe
        file_hash = hashlib.sha256(content).hexdigest()

        # Verificar duplicata (apenas alerta, não bloqueia)
        existing = await self.db.execute(
            select(Document).where(
                Document.user_id == user.id,
                Document.file_hash == file_hash,
            ).limit(1)
        )
        is_duplicate = existing.scalar_one_or_none() is not None

        # Salvar arquivo
        upload_dir = Path(settings.upload_dir) / str(user.id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        file_path = upload_dir / f"{file_hash}.{ext}"
        with open(file_path, "wb") as f:
            f.write(content)

        # Criar registro
        document = Document(
            user_id=user.id,
            file_path=str(file_path),
            file_hash=file_hash,
            file_size=len(content),
            mime_type=file.content_type or f"application/{ext}",
            original_filename=file.filename or "unknown",
            status=DocumentStatus.PENDING,
        )
        self.db.add(document)
        await self.db.flush()
        await self.db.refresh(document)

        # Processar documento e extrair dados (sem salvar extração)
        extraction_data = await self._process_document(document, content)

        # Retornar resposta com flag de duplicata e itens extraídos (não salvos)
        from ..schemas.document import DocumentResponse, ExtractedItemResponse

        response = DocumentResponse.model_validate(document)
        response.is_duplicate = is_duplicate

        # Converter itens extraídos para o formato de resposta
        if extraction_data and extraction_data.get('items'):
            response.extracted_items = [
                ExtractedItemResponse(
                    description=item.get('description', 'Item'),
                    amount=item.get('amount', 0),
                    date=item.get('date'),
                    category=item.get('category'),
                    confidence=item.get('confidence', 0.9),
                )
                for item in extraction_data['items']
                if item.get('amount', 0) > 0
            ]

        return response

    async def get_by_id(self, user: User, document_id: int) -> Document | None:
        result = await self.db.execute(
            select(Document).where(
                Document.id == document_id,
                Document.user_id == user.id,
            )
        )
        return result.scalar_one_or_none()

    async def list(self, user: User, limit: int = 50, offset: int = 0) -> list[Document]:
        result = await self.db.execute(
            select(Document)
            .where(Document.user_id == user.id)
            .order_by(Document.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def retry_processing(self, user: User, document_id: int) -> Document:
        document = await self.get_by_id(user, document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Documento não encontrado",
            )

        if document.status == DocumentStatus.PROCESSING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Documento já está sendo processado",
            )

        # Ler arquivo e reprocessar
        with open(document.file_path, "rb") as f:
            content = f.read()

        document.status = DocumentStatus.PENDING
        await self._process_document(document, content)
        return document

    async def delete(self, user: User, document_id: int) -> None:
        document = await self.get_by_id(user, document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Documento não encontrado",
            )

        # Apagar arquivo
        if os.path.exists(document.file_path):
            os.remove(document.file_path)

        await self.db.delete(document)

    async def _process_document(self, document: Document, content: bytes) -> dict | None:
        """Processa documento e extrai dados (NÃO salva - retorna para confirmação)"""
        try:
            document.status = DocumentStatus.PROCESSING

            # Extrair dados com LLM
            extraction_data = await self._extract_data(document, content)

            document.status = DocumentStatus.COMPLETED
            document.processed_at = datetime.utcnow()

            await self.db.flush()
            await self.db.refresh(document)

            return extraction_data

        except Exception as e:
            document.status = DocumentStatus.FAILED
            document.error_message = str(e)
            await self.db.flush()
            await self.db.refresh(document)
            return None

    async def _extract_data(
        self, document: Document, content: bytes
    ) -> dict | None:
        """Extrai dados do documento usando LLM com visão (retorna lista de itens)"""
        from .llm_ocr_service import LLMOCRService

        # Executar extração com LLM
        llm_service = LLMOCRService()
        llm_result = await llm_service.extract_from_image(content, document.mime_type)

        # Se houve erro na extração
        if llm_result.get('error'):
            document.error_message = llm_result['error']
            return None

        # Determinar tipo de documento
        doc_type = llm_result.get('document_type')
        if doc_type:
            document.document_type = doc_type

        # Retornar itens individuais com categoria
        items = llm_result.get('items', [])

        return {
            'items': items,
            'document_type': doc_type,
        }
