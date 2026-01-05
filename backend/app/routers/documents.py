from fastapi import APIRouter, UploadFile, File, HTTPException, Query

from ..core.deps import CurrentUser, DbSession
from ..schemas.document import DocumentResponse
from ..services.document_service import DocumentService

router = APIRouter()


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
):
    """
    Upload de documento (foto/PDF) para processamento.
    Retorna dados extraídos para confirmação (não salva automaticamente).
    Inclui alerta is_duplicate se documento já foi enviado antes.
    """
    service = DocumentService(db)
    # Service agora retorna DocumentResponse diretamente
    return await service.upload(current_user, file)


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    """Lista documentos do usuário"""
    service = DocumentService(db)
    return await service.list(current_user, limit=limit, offset=offset)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Retorna documento com status e dados extraídos"""
    service = DocumentService(db)
    document = await service.get_by_id(current_user, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    # Adicionar última extração ao response
    response = DocumentResponse.model_validate(document)
    if document.extractions:
        from ..schemas.document import DocumentExtractionResponse
        response.extraction = DocumentExtractionResponse.model_validate(
            document.extractions[0]
        )

    return response


@router.post("/{document_id}/retry", response_model=DocumentResponse)
async def retry_document_processing(
    document_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Reprocessa documento que falhou"""
    service = DocumentService(db)
    return await service.retry_processing(current_user, document_id)


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Remove documento e arquivo associado"""
    service = DocumentService(db)
    await service.delete(current_user, document_id)
