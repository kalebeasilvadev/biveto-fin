import asyncio
import hashlib
import os
from datetime import datetime, date
from decimal import Decimal
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from fastapi import HTTPException, status, UploadFile

from app.models.document import Document, DocumentExtraction, DocumentStatus
from app.models.transaction import Transaction
from app.models.user import User
from app.core.config import settings
from app.core.utils import utc_now


def _write_file_sync(file_path: Path, content: bytes) -> None:
    """Escrita sincrona de arquivo - para uso com asyncio.to_thread"""
    with open(file_path, "wb") as f:
        f.write(content)


def _read_file_sync(file_path: str) -> bytes:
    """Leitura sincrona de arquivo - para uso com asyncio.to_thread"""
    with open(file_path, "rb") as f:
        return f.read()


class DocumentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def upload(self, user: User, file: UploadFile) -> Document:
        # Validar extensao
        ext = file.filename.split(".")[-1].lower() if file.filename else ""
        if ext not in settings.allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Extensao nao permitida. Use: {', '.join(settings.allowed_extensions)}",
            )

        # Ler conteudo
        content = await file.read()

        # Validar tamanho
        if len(content) > settings.max_upload_size_mb * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Arquivo muito grande. Maximo: {settings.max_upload_size_mb}MB",
            )

        # Calcular hash para dedupe
        file_hash = hashlib.sha256(content).hexdigest()

        # Verificar se e duplicata (apenas informativo)
        existing_result = await self.db.execute(
            select(Document).where(
                Document.user_id == user.id,
                Document.file_hash == file_hash,
            ).limit(1)
        )
        existing_document = existing_result.scalar_one_or_none()
        is_duplicate = existing_document is not None

        if is_duplicate:
            print(f"[DOC_SVC] Duplicate detected (informative only): existing_id={existing_document.id}")

        # Salvar arquivo
        upload_dir = Path(settings.upload_dir) / str(user.id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        file_path = upload_dir / f"{file_hash}.{ext}"
        # Escrita em thread separada para nao bloquear o event loop
        await asyncio.to_thread(_write_file_sync, file_path, content)

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

        # Processar documento e extrair dados (sem salvar extracao)
        extraction_data = await self._process_document(document, content)

        # Retornar resposta com flag de duplicata e itens extraidos (nao salvos)
        from app.modules.documents.schemas.document import DocumentResponse, ExtractedItemResponse, CardInfoResponse

        response = DocumentResponse.model_validate(document)
        response.is_duplicate = is_duplicate

        # Converter itens extraidos para o formato de resposta e verificar duplicados
        if extraction_data and extraction_data.get('items'):
            # Detectar recorrencias (Netflix, Spotify, etc.)
            from app.modules.known_services.services.recurring_detector import RecurringDetectorService
            recurring_detector = RecurringDetectorService(self.db)

            card_info = extraction_data.get('card_info', {})
            invoice_month = card_info.get('invoice_month') if card_info else None
            invoice_year = card_info.get('invoice_year') if card_info else None

            items_with_detection = await recurring_detector.detect_all(
                user=user,
                items=extraction_data['items'],
                invoice_month=invoice_month,
                invoice_year=invoice_year,
            )

            extracted_items = []
            for item in items_with_detection:
                if item.get('amount', 0) == 0:
                    continue

                # Verificar se ja existe transacao similar
                duplicate_info = await self._check_duplicate_transaction(
                    user=user,
                    description=item.get('description', 'Item'),
                    amount=item.get('amount', 0),
                    item_date=item.get('date'),
                )

                # Converter future_installments se existir
                future_installments = None
                if item.get('future_installments'):
                    from app.modules.documents.schemas.document import FutureInstallmentResponse
                    future_installments = [
                        FutureInstallmentResponse(
                            installment=fi.get('installment'),
                            reference_month=fi.get('reference_month'),
                            reference_year=fi.get('reference_year'),
                        )
                        for fi in item['future_installments']
                        if fi.get('installment') and fi.get('reference_month') and fi.get('reference_year')
                    ]

                # Converter recurring_detection se existir
                recurring_detection = None
                if item.get('recurring_detection'):
                    from app.modules.known_services.schemas.recurring_detection import RecurringDetection
                    recurring_detection = RecurringDetection(**item['recurring_detection'])

                extracted_items.append(ExtractedItemResponse(
                    description=item.get('description', 'Item'),
                    amount=item.get('amount', 0),
                    date=item.get('date'),
                    category=item.get('category'),
                    confidence=item.get('confidence', 0.9),
                    transaction_type=item.get('transaction_type'),  # Tipo extraido pelo LLM
                    is_installment=item.get('is_installment', False),
                    installment_current=item.get('installment_current'),
                    installment_total=item.get('installment_total'),
                    future_installments=future_installments if future_installments else None,
                    is_duplicate=duplicate_info['is_duplicate'],
                    existing_transaction_id=duplicate_info.get('transaction_id'),
                    recurring_detection=recurring_detection,
                    # Campos para cupom fiscal (grocery tracking)
                    quantity=item.get('quantity'),
                    unit=item.get('unit'),
                    unit_price=item.get('unit_price'),
                    grocery_category=item.get('grocery_category'),
                    necessity_type=item.get('necessity_type'),
                ))

            response.extracted_items = extracted_items

        # Incluir informacoes do cartao (para faturas)
        if extraction_data and extraction_data.get('card_info'):
            card_info = extraction_data['card_info']
            response.card_info = CardInfoResponse(
                card_issuer=card_info.get('card_issuer'),
                card_bank=card_info.get('card_bank'),
                card_brand=card_info.get('card_brand'),
                card_partner=card_info.get('card_partner'),
                card_last_digits=card_info.get('card_last_digits'),
                card_name=card_info.get('card_name'),
                invoice_month=card_info.get('invoice_month'),
                invoice_year=card_info.get('invoice_year'),
                closing_date=card_info.get('closing_date'),
                closing_day=card_info.get('closing_day'),
                due_date=card_info.get('due_date'),
                due_day=card_info.get('due_day'),
                total_amount=card_info.get('total_amount'),
                credit_limit=card_info.get('credit_limit'),
                credit_used=card_info.get('credit_used'),
                credit_available=card_info.get('credit_available'),
            )

        # Incluir informacoes de pagamento (para cupom fiscal)
        if extraction_data and extraction_data.get('payment_info'):
            from app.modules.documents.schemas.document import PaymentInfoResponse, DetectedPaymentResponse
            payment_info = extraction_data['payment_info']
            payments = []
            for p in payment_info.get('payments', []):
                payments.append(DetectedPaymentResponse(
                    method=p.get('method', ''),
                    amount=p.get('amount', 0),
                    label=p.get('label', ''),
                    sequence=p.get('sequence', 0),
                ))
            response.payment_info = PaymentInfoResponse(
                total=payment_info.get('total'),
                subtotal=payment_info.get('subtotal'),
                discount=payment_info.get('discount'),
                payments=payments,
            )

        return response

    async def upload_batch(self, user: User, files: list) -> Document:
        """Upload de multiplas imagens como 1 documento (para cupons grandes)"""
        from app.modules.documents.schemas.document import DocumentResponse, ExtractedItemResponse, CardInfoResponse

        # Validar quantidade de arquivos
        if len(files) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhum arquivo enviado",
            )
        if len(files) > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximo de 10 arquivos permitido",
            )

        # Extensoes permitidas para batch (apenas imagens)
        allowed_batch_extensions = {'jpg', 'jpeg', 'png', 'heic', 'heif'}

        # Processar cada arquivo
        images: list[tuple[bytes, str]] = []
        total_size = 0
        combined_hash_data = b''

        for file in files:
            ext = file.filename.split(".")[-1].lower() if file.filename else ""
            if ext not in allowed_batch_extensions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Extensao '{ext}' nao permitida. Use: {', '.join(allowed_batch_extensions)}",
                )

            content = await file.read()
            total_size += len(content)

            # Validar tamanho individual (10MB por arquivo)
            if len(content) > settings.max_upload_size_mb * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Arquivo muito grande. Maximo: {settings.max_upload_size_mb}MB por arquivo",
                )

            # Converter HEIC para JPEG se necessario
            if ext in ('heic', 'heif'):
                content, mime_type = await self._convert_heic_to_jpeg(content)
            else:
                mime_type = file.content_type or f"image/{ext}"
                # Normalizar mime_type
                if mime_type == 'image/jpg':
                    mime_type = 'image/jpeg'

            images.append((content, mime_type))
            combined_hash_data += content

        # Validar tamanho total (50MB)
        max_total_size = 50 * 1024 * 1024
        if total_size > max_total_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tamanho total muito grande. Maximo: 50MB",
            )

        # Calcular hash combinado para dedupe
        file_hash = hashlib.sha256(combined_hash_data).hexdigest()

        # Verificar se e duplicata
        existing_result = await self.db.execute(
            select(Document).where(
                Document.user_id == user.id,
                Document.file_hash == file_hash,
            ).limit(1)
        )
        existing_document = existing_result.scalar_one_or_none()
        is_duplicate = existing_document is not None

        if is_duplicate:
            print(f"[DOC_SVC] Batch duplicate detected (informative only): existing_id={existing_document.id}")

        # Salvar primeira imagem como referencia
        upload_dir = Path(settings.upload_dir) / str(user.id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        first_content, first_mime = images[0]
        ext = 'jpg' if 'jpeg' in first_mime else first_mime.split('/')[-1]
        file_path = upload_dir / f"{file_hash}.{ext}"
        await asyncio.to_thread(_write_file_sync, file_path, first_content)

        # Criar registro do documento
        document = Document(
            user_id=user.id,
            file_path=str(file_path),
            file_hash=file_hash,
            file_size=total_size,
            mime_type=first_mime,
            original_filename=f"batch_{len(files)}_images",
            status=DocumentStatus.PENDING,
        )
        self.db.add(document)
        await self.db.flush()
        await self.db.refresh(document)

        # Processar multiplas imagens usando LLM
        extraction_data = await self._process_batch_images(document, images)

        # Construir resposta
        response = DocumentResponse.model_validate(document)
        response.is_duplicate = is_duplicate

        # Converter itens extraidos para o formato de resposta
        if extraction_data and extraction_data.get('items'):
            from app.modules.known_services.services.recurring_detector import RecurringDetectorService
            recurring_detector = RecurringDetectorService(self.db)

            card_info = extraction_data.get('card_info', {})
            invoice_month = card_info.get('invoice_month') if card_info else None
            invoice_year = card_info.get('invoice_year') if card_info else None

            items_with_detection = await recurring_detector.detect_all(
                user=user,
                items=extraction_data['items'],
                invoice_month=invoice_month,
                invoice_year=invoice_year,
            )

            extracted_items = []
            for item in items_with_detection:
                if item.get('amount', 0) == 0:
                    continue

                duplicate_info = await self._check_duplicate_transaction(
                    user=user,
                    description=item.get('description', 'Item'),
                    amount=item.get('amount', 0),
                    item_date=item.get('date'),
                )

                future_installments = None
                if item.get('future_installments'):
                    from app.modules.documents.schemas.document import FutureInstallmentResponse
                    future_installments = [
                        FutureInstallmentResponse(
                            installment=fi.get('installment'),
                            reference_month=fi.get('reference_month'),
                            reference_year=fi.get('reference_year'),
                        )
                        for fi in item['future_installments']
                        if fi.get('installment') and fi.get('reference_month') and fi.get('reference_year')
                    ]

                recurring_detection = None
                if item.get('recurring_detection'):
                    from app.modules.known_services.schemas.recurring_detection import RecurringDetection
                    recurring_detection = RecurringDetection(**item['recurring_detection'])

                extracted_items.append(ExtractedItemResponse(
                    description=item.get('description', 'Item'),
                    amount=item.get('amount', 0),
                    date=item.get('date'),
                    category=item.get('category'),
                    confidence=item.get('confidence', 0.9),
                    transaction_type=item.get('transaction_type'),
                    is_installment=item.get('is_installment', False),
                    installment_current=item.get('installment_current'),
                    installment_total=item.get('installment_total'),
                    future_installments=future_installments if future_installments else None,
                    is_duplicate=duplicate_info['is_duplicate'],
                    existing_transaction_id=duplicate_info.get('transaction_id'),
                    recurring_detection=recurring_detection,
                    quantity=item.get('quantity'),
                    unit=item.get('unit'),
                    unit_price=item.get('unit_price'),
                    grocery_category=item.get('grocery_category'),
                    necessity_type=item.get('necessity_type'),
                ))

            response.extracted_items = extracted_items

        if extraction_data and extraction_data.get('card_info'):
            card_info = extraction_data['card_info']
            response.card_info = CardInfoResponse(
                card_issuer=card_info.get('card_issuer'),
                card_bank=card_info.get('card_bank'),
                card_brand=card_info.get('card_brand'),
                card_partner=card_info.get('card_partner'),
                card_last_digits=card_info.get('card_last_digits'),
                card_name=card_info.get('card_name'),
                invoice_month=card_info.get('invoice_month'),
                invoice_year=card_info.get('invoice_year'),
                closing_date=card_info.get('closing_date'),
                closing_day=card_info.get('closing_day'),
                due_date=card_info.get('due_date'),
                due_day=card_info.get('due_day'),
                total_amount=card_info.get('total_amount'),
                credit_limit=card_info.get('credit_limit'),
                credit_used=card_info.get('credit_used'),
                credit_available=card_info.get('credit_available'),
            )

        # Incluir informacoes de pagamento (para cupom fiscal)
        if extraction_data and extraction_data.get('payment_info'):
            from app.modules.documents.schemas.document import PaymentInfoResponse, DetectedPaymentResponse
            payment_info = extraction_data['payment_info']
            payments = []
            for p in payment_info.get('payments', []):
                payments.append(DetectedPaymentResponse(
                    method=p.get('method', ''),
                    amount=p.get('amount', 0),
                    label=p.get('label', ''),
                    sequence=p.get('sequence', 0),
                ))
            response.payment_info = PaymentInfoResponse(
                total=payment_info.get('total'),
                subtotal=payment_info.get('subtotal'),
                discount=payment_info.get('discount'),
                payments=payments,
            )

        return response

    async def _convert_heic_to_jpeg(self, heic_content: bytes) -> tuple[bytes, str]:
        """Converte imagem HEIC para JPEG usando pillow-heif"""
        import io

        def _convert():
            try:
                import pillow_heif
                from PIL import Image

                # Registrar o plugin HEIF
                pillow_heif.register_heif_opener()

                # Abrir imagem HEIC
                img = Image.open(io.BytesIO(heic_content))

                # Converter para RGB se necessario (HEIC pode ter alpha)
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')

                # Salvar como JPEG
                output = io.BytesIO()
                img.save(output, format='JPEG', quality=85)
                return output.getvalue()
            except ImportError:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="pillow-heif nao instalado. Execute: pip install pillow-heif",
                )
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Erro ao converter HEIC: {str(e)}",
                )

        jpeg_content = await asyncio.to_thread(_convert)
        return jpeg_content, 'image/jpeg'

    async def _process_batch_images(self, document: Document, images: list[tuple[bytes, str]]) -> dict | None:
        """Processa multiplas imagens e extrai dados usando LLM"""
        try:
            print(f"[DOC_SVC] _process_batch_images: id={document.id}, num_images={len(images)}")
            document.status = DocumentStatus.PROCESSING
            await self.db.flush()

            # Usar LLM com visao para processar multiplas imagens
            # Mistral como provider principal (melhor OCR)
            from app.modules.documents.services.llm_ocr_service import LLMOCRService
            if settings.mistral_api_key:
                llm_service = LLMOCRService(provider='mistral', model=settings.mistral_llm_model)
                print(f"[DOC_SVC] Using Mistral for batch image extraction")
            else:
                llm_service = LLMOCRService(provider='google', model=settings.vision_model or 'gemini-2.0-flash')
                print(f"[DOC_SVC] Using Google for batch image extraction (Mistral not configured)")
            result = await llm_service.extract_from_multiple_images(images)

            items_count = len(result.get('items', [])) if result else 0
            print(f"[DOC_SVC] Batch extraction returned: items={items_count}, error={result.get('error')}")

            if result is None or (not result.get('items') and result.get('error')):
                document.status = DocumentStatus.FAILED
                document.error_message = result.get('error') if result else 'Extracao falhou'
                print(f"[DOC_SVC] Document {document.id} marked as FAILED: {document.error_message}")
            else:
                document.status = DocumentStatus.COMPLETED
                print(f"[DOC_SVC] Document {document.id} marked as COMPLETED with {items_count} items")

            # Determinar tipo de documento
            doc_type = result.get('document_type')
            if doc_type:
                document.document_type = doc_type

            document.processed_at = utc_now()
            await self.db.flush()
            await self.db.refresh(document)

            return result

        except Exception as e:
            print(f"[DOC_SVC] EXCEPTION in _process_batch_images: {e}")
            import traceback
            traceback.print_exc()
            document.status = DocumentStatus.FAILED
            document.error_message = str(e)
            await self.db.flush()
            await self.db.refresh(document)
            return None

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
                detail="Documento nao encontrado",
            )

        if document.status == DocumentStatus.PROCESSING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Documento ja esta sendo processado",
            )

        # Ler arquivo em thread separada para nao bloquear o event loop
        content = await asyncio.to_thread(_read_file_sync, document.file_path)

        document.status = DocumentStatus.PENDING
        await self._process_document(document, content)
        return document

    async def delete(self, user: User, document_id: int) -> None:
        document = await self.get_by_id(user, document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Documento nao encontrado",
            )

        # Apagar arquivo
        if os.path.exists(document.file_path):
            os.remove(document.file_path)

        await self.db.delete(document)

    async def _process_document(self, document: Document, content: bytes) -> dict | None:
        """Processa documento e extrai dados (NAO salva - retorna para confirmacao)"""
        try:
            print(f"[DOC_SVC] _process_document: id={document.id}, mime_type={document.mime_type}, content_size={len(content)}")
            document.status = DocumentStatus.PROCESSING
            await self.db.flush()

            # Extrair dados com LLM
            print(f"[DOC_SVC] Calling _extract_data...")
            extraction_data = await self._extract_data(document, content)
            items_count = len(extraction_data.get('items', [])) if extraction_data else 0
            print(f"[DOC_SVC] _extract_data returned: items={items_count}, error={document.error_message}")

            # Se houve erro na extracao, marcar como falha
            if extraction_data is None or (not extraction_data.get('items') and document.error_message):
                document.status = DocumentStatus.FAILED
                print(f"[DOC_SVC] Document {document.id} marked as FAILED: {document.error_message}")
            else:
                document.status = DocumentStatus.COMPLETED
                print(f"[DOC_SVC] Document {document.id} marked as COMPLETED with {items_count} items")

            document.processed_at = utc_now()
            await self.db.flush()
            await self.db.refresh(document)

            return extraction_data

        except Exception as e:
            print(f"[DOC_SVC] EXCEPTION in _process_document: {e}")
            import traceback
            traceback.print_exc()
            document.status = DocumentStatus.FAILED
            document.error_message = str(e)
            await self.db.flush()
            await self.db.refresh(document)
            return None

    async def _extract_data(
        self, document: Document, content: bytes
    ) -> dict | None:
        """Extrai dados do documento usando LLM com visao ou parser de planilha"""
        print(f"[DOC_SVC] _extract_data: content_size={len(content)}")

        # Verificar se e CSV ou Excel
        mime_type = document.mime_type or ''
        filename = document.original_filename or ''

        is_spreadsheet = (
            mime_type in ['text/csv', 'application/csv',
                          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                          'application/vnd.ms-excel'] or
            filename.lower().endswith(('.csv', '.xlsx', '.xls'))
        )

        print(f"[DOC_SVC] mime_type={mime_type}, filename={filename}, is_spreadsheet={is_spreadsheet}")

        if is_spreadsheet:
            # Usar parser de planilha
            from app.modules.documents.services.spreadsheet_parser_service import SpreadsheetParserService
            parser = SpreadsheetParserService()
            result = await parser.parse_file(content, filename, mime_type)
        else:
            # Usar LLM com visao para imagens/PDFs
            # Mistral como provider principal (melhor OCR para todos os tipos)
            if settings.mistral_api_key:
                selected_provider = 'mistral'
                selected_model = settings.mistral_llm_model
                print(f"[DOC_SVC] Using Mistral for extraction")
            else:
                selected_provider = 'google'
                selected_model = settings.vision_model or 'gemini-2.0-flash'
                print(f"[DOC_SVC] Using Google for extraction (Mistral not configured)")

            from app.modules.documents.services.llm_ocr_service import LLMOCRService
            llm_service = LLMOCRService(provider=selected_provider, model=selected_model)
            result = await llm_service.extract_from_image(content, mime_type, filename=filename)
            print(f"[DOC_SVC] LLM OCR result: items={len(result.get('items', []))}, error={result.get('error')}")

        # Se houve erro na extracao
        if result.get('error'):
            document.error_message = result['error']
            return None

        # Determinar tipo de documento
        doc_type = result.get('document_type')
        if doc_type:
            document.document_type = doc_type

        # Retornar itens individuais com categoria, info do cartao e info de pagamento
        items = result.get('items', [])
        card_info = result.get('card_info')
        payment_info = result.get('payment_info')

        return {
            'items': items,
            'document_type': doc_type,
            'card_info': card_info,
            'payment_info': payment_info,
        }

    async def _check_duplicate_transaction(
        self,
        user: User,
        description: str,
        amount: float,
        item_date: str | None,
    ) -> dict:
        """
        Verifica se ja existe uma transacao similar no banco.

        Uma transacao e considerada duplicada se:
        - Mesmo usuario
        - Mesmo valor (absoluto, com tolerancia de R$ 0.01)
        - Descricao similar (contem partes em comum)
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

            # Buscar transacoes com mesmo valor (tolerancia de 0.01)
            amount_decimal = Decimal(str(abs(amount)))
            tolerance = Decimal('0.01')

            query = select(Transaction).where(
                Transaction.user_id == user.id,
                func.abs(Transaction.amount - amount_decimal) <= tolerance,
            )

            # Filtrar por data se disponivel
            if target_date:
                query = query.where(Transaction.date == target_date)

            result = await self.db.execute(query.limit(10))
            candidates = list(result.scalars().all())

            if not candidates:
                return {'is_duplicate': False, 'transaction_id': None}

            # Verificar similaridade de descricao
            description_lower = description.lower().strip()
            description_words = set(description_lower.split())

            for txn in candidates:
                txn_desc = (txn.description or '').lower().strip()
                txn_words = set(txn_desc.split())

                # Considerar duplicado se:
                # 1. Descricoes sao iguais
                # 2. Uma contem a outra
                # 3. Tem palavras significativas em comum (>= 50% das palavras)
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
            # Em caso de erro, nao marcar como duplicado
            return {'is_duplicate': False, 'transaction_id': None}
