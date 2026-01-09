import hashlib
import os
from datetime import datetime, date
from decimal import Decimal
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from fastapi import HTTPException, status, UploadFile

from ..models.document import Document, DocumentExtraction, DocumentStatus
from ..models.transaction import Transaction
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

        # Verificar duplicata - retornar documento existente se já foi enviado
        existing_result = await self.db.execute(
            select(Document).where(
                Document.user_id == user.id,
                Document.file_hash == file_hash,
            ).limit(1)
        )
        existing_document = existing_result.scalar_one_or_none()

        if existing_document:
            # Verificar se o arquivo ainda existe (pode ter sido perdido em redeploy)
            if os.path.exists(existing_document.file_path):
                with open(existing_document.file_path, "rb") as f:
                    existing_content = f.read()
            else:
                # Arquivo perdido - restaurar com o conteúdo atual (mesmo hash = mesmo conteúdo)
                upload_dir = Path(existing_document.file_path).parent
                upload_dir.mkdir(parents=True, exist_ok=True)
                with open(existing_document.file_path, "wb") as f:
                    f.write(content)
                existing_content = content

            # Reprocessar o documento para retornar os itens extraídos
            extraction_data = await self._process_document(existing_document, existing_content)

            from ..schemas.document import DocumentResponse, ExtractedItemResponse, CardInfoResponse

            response = DocumentResponse.model_validate(existing_document)
            response.is_duplicate = True

            if extraction_data:
                response.extracted_items = [
                    ExtractedItemResponse(**item) for item in extraction_data.get("items", [])
                ]
                if extraction_data.get("card_info"):
                    response.card_info = CardInfoResponse(**extraction_data["card_info"])

            return response

        is_duplicate = False

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
        from ..schemas.document import DocumentResponse, ExtractedItemResponse, CardInfoResponse

        response = DocumentResponse.model_validate(document)
        response.is_duplicate = is_duplicate

        # Converter itens extraídos para o formato de resposta e verificar duplicados
        if extraction_data and extraction_data.get('items'):
            extracted_items = []
            for item in extraction_data['items']:
                if item.get('amount', 0) == 0:
                    continue

                # Verificar se já existe transação similar
                duplicate_info = await self._check_duplicate_transaction(
                    user=user,
                    description=item.get('description', 'Item'),
                    amount=item.get('amount', 0),
                    item_date=item.get('date'),
                )

                extracted_items.append(ExtractedItemResponse(
                    description=item.get('description', 'Item'),
                    amount=item.get('amount', 0),
                    date=item.get('date'),
                    category=item.get('category'),
                    confidence=item.get('confidence', 0.9),
                    is_installment=item.get('is_installment', False),
                    installment_current=item.get('installment_current'),
                    installment_total=item.get('installment_total'),
                    is_duplicate=duplicate_info['is_duplicate'],
                    existing_transaction_id=duplicate_info.get('transaction_id'),
                ))

            response.extracted_items = extracted_items

        # Incluir informações do cartão (para faturas)
        if extraction_data and extraction_data.get('card_info'):
            card_info = extraction_data['card_info']
            response.card_info = CardInfoResponse(
                card_issuer=card_info.get('card_issuer'),
                card_last_digits=card_info.get('card_last_digits'),
                invoice_month=card_info.get('invoice_month'),
                invoice_year=card_info.get('invoice_year'),
                due_date=card_info.get('due_date'),
                total_amount=card_info.get('total_amount'),
            )

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
            await self.db.flush()

            # Extrair dados com LLM
            extraction_data = await self._extract_data(document, content)

            # Se houve erro na extração, marcar como falha
            if extraction_data is None or (not extraction_data.get('items') and document.error_message):
                document.status = DocumentStatus.FAILED
            else:
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
        """Extrai dados do documento usando LLM com visão ou parser de planilha"""

        # Verificar se é CSV ou Excel
        mime_type = document.mime_type or ''
        filename = document.original_filename or ''

        is_spreadsheet = (
            mime_type in ['text/csv', 'application/csv',
                          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                          'application/vnd.ms-excel'] or
            filename.lower().endswith(('.csv', '.xlsx', '.xls'))
        )

        if is_spreadsheet:
            # Usar parser de planilha
            from .spreadsheet_parser_service import SpreadsheetParserService
            parser = SpreadsheetParserService()
            result = await parser.parse_file(content, filename, mime_type)
        else:
            # Usar LLM com visão para imagens/PDFs
            from .llm_ocr_service import LLMOCRService
            llm_service = LLMOCRService()
            result = await llm_service.extract_from_image(content, mime_type)

        # Se houve erro na extração
        if result.get('error'):
            document.error_message = result['error']
            return None

        # Determinar tipo de documento
        doc_type = result.get('document_type')
        if doc_type:
            document.document_type = doc_type

        # Retornar itens individuais com categoria e info do cartão
        items = result.get('items', [])
        card_info = result.get('card_info')

        return {
            'items': items,
            'document_type': doc_type,
            'card_info': card_info,
        }

    async def _check_duplicate_transaction(
        self,
        user: User,
        description: str,
        amount: float,
        item_date: str | None,
    ) -> dict:
        """
        Verifica se já existe uma transação similar no banco.

        Uma transação é considerada duplicada se:
        - Mesmo usuário
        - Mesmo valor (absoluto, com tolerância de R$ 0.01)
        - Descrição similar (contém partes em comum)
        - Mesma data (se fornecida)

        Returns:
            dict com is_duplicate (bool) e transaction_id (int | None)
        """
        try:
            # Converter data se fornecida
            target_date = None
            if item_date:
                try:
                    target_date = date.fromisoformat(item_date)
                except ValueError:
                    pass

            # Buscar transações com mesmo valor (tolerância de 0.01)
            amount_decimal = Decimal(str(abs(amount)))
            tolerance = Decimal('0.01')

            query = select(Transaction).where(
                Transaction.user_id == user.id,
                func.abs(Transaction.amount - amount_decimal) <= tolerance,
            )

            # Filtrar por data se disponível
            if target_date:
                query = query.where(Transaction.date == target_date)

            result = await self.db.execute(query.limit(10))
            candidates = list(result.scalars().all())

            if not candidates:
                return {'is_duplicate': False, 'transaction_id': None}

            # Verificar similaridade de descrição
            description_lower = description.lower().strip()
            description_words = set(description_lower.split())

            for txn in candidates:
                txn_desc = (txn.description or '').lower().strip()
                txn_words = set(txn_desc.split())

                # Considerar duplicado se:
                # 1. Descrições são iguais
                # 2. Uma contém a outra
                # 3. Têm palavras significativas em comum (>= 50% das palavras)
                if description_lower == txn_desc:
                    return {'is_duplicate': True, 'transaction_id': txn.id}

                if description_lower in txn_desc or txn_desc in description_lower:
                    return {'is_duplicate': True, 'transaction_id': txn.id}

                # Verificar palavras em comum (ignorar palavras curtas)
                significant_words = {w for w in description_words if len(w) > 3}
                txn_significant = {w for w in txn_words if len(w) > 3}

                if significant_words and txn_significant:
                    common = significant_words & txn_significant
                    similarity = len(common) / max(len(significant_words), len(txn_significant))
                    if similarity >= 0.5:
                        return {'is_duplicate': True, 'transaction_id': txn.id}

            return {'is_duplicate': False, 'transaction_id': None}

        except Exception:
            # Em caso de erro, não marcar como duplicado
            return {'is_duplicate': False, 'transaction_id': None}
