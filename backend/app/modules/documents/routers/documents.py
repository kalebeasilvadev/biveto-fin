from fastapi import APIRouter, UploadFile, File, HTTPException, Query

from app.core.deps import CurrentUser, DbSession
from app.modules.documents.schemas.document import DocumentResponse
from app.modules.documents.schemas.qrcode import (
    QRCodeScanRequest,
    QRCodeExtractionResponse,
    NFCeFetchResponse,
    QRCodeFullScanResponse,
)
from app.modules.documents.services.document_service import DocumentService
from app.modules.documents.services.qrcode_service import QRCodeService
from app.modules.documents.services.nfce_service import NFCeService

router = APIRouter()


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
):
    """
    Upload de documento (foto/PDF) para processamento.
    Retorna dados extraidos para confirmacao (nao salva automaticamente).
    Inclui alerta is_duplicate se documento ja foi enviado antes.
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
    """Lista documentos do usuario"""
    service = DocumentService(db)
    return await service.list(current_user, limit=limit, offset=offset)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Retorna documento com status e dados extraidos"""
    service = DocumentService(db)
    document = await service.get_by_id(current_user, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Documento nao encontrado")

    # Adicionar ultima extracao ao response
    response = DocumentResponse.model_validate(document)
    if document.extractions:
        from app.modules.documents.schemas.document import DocumentExtractionResponse
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


# ============================================
# QR Code Scanning (NFCe)
# ============================================

@router.post("/scan-qrcode", response_model=QRCodeFullScanResponse)
async def scan_qrcode(
    data: QRCodeScanRequest,
    current_user: CurrentUser,
):
    """
    Escaneia QR Code de cupom fiscal (NFCe) e retorna os dados completos.

    Aceita:
    - image_base64: Imagem do QR Code em base64
    - url: URL da NFCe diretamente
    - access_key: Chave de acesso de 44 dígitos

    Retorna os dados completos da NFCe incluindo todos os itens com nomes
    não truncados (diferente da foto do cupom).

    Se a NFCe ainda não estiver disponível na SEFAZ, sugere usar a opção
    de foto como fallback.
    """
    # Validate input - at least one must be provided
    if not data.image_base64 and not data.url and not data.access_key:
        raise HTTPException(
            status_code=400,
            detail="Forneça image_base64, url ou access_key"
        )

    # Step 1: Extract QR code if image provided
    qr_url = data.url
    qr_access_key = data.access_key
    qr_extraction_success = True
    qr_error = None

    if data.image_base64 and not qr_url:
        result = QRCodeService.extract_from_base64(data.image_base64)

        if not result.is_success:
            return QRCodeFullScanResponse(
                qr_extraction_success=False,
                qr_error=result.error,
                fallback_suggested=True,
                message="Não foi possível ler o QR Code. Tente usar a opção de foto do cupom.",
            )

        qr_url = result.url
        qr_access_key = result.access_key
        qr_extraction_success = True

    # Step 2: Fetch NFCe data
    if qr_url:
        nfce_result = await NFCeService.fetch_from_url(qr_url)
    elif qr_access_key:
        nfce_result = await NFCeService.fetch_from_access_key(qr_access_key)
    else:
        return QRCodeFullScanResponse(
            qr_extraction_success=qr_extraction_success,
            qr_url=qr_url,
            qr_access_key=qr_access_key,
            nfce_fetch_success=False,
            nfce_error="URL ou chave de acesso não encontrada",
            fallback_suggested=True,
            message="QR Code lido, mas não foi possível extrair a URL da NFCe.",
        )

    # Build response
    if nfce_result.is_success:
        from app.modules.documents.schemas.qrcode import NFCeDataResponse, NFCeItemResponse

        nfce_data = NFCeDataResponse(
            chave_acesso=nfce_result.data.chave_acesso,
            data_emissao=nfce_result.data.data_emissao,
            cnpj_emitente=nfce_result.data.cnpj_emitente,
            nome_emitente=nfce_result.data.nome_emitente,
            valor_total=float(nfce_result.data.valor_total),
            itens=[
                NFCeItemResponse(
                    codigo=item.codigo,
                    descricao=item.descricao,
                    quantidade=float(item.quantidade),
                    unidade=item.unidade,
                    valor_unitario=float(item.valor_unitario),
                    valor_total=float(item.valor_total),
                    ncm=item.ncm,
                )
                for item in nfce_result.data.itens
            ],
            endereco_emitente=nfce_result.data.endereco_emitente,
            forma_pagamento=nfce_result.data.forma_pagamento,
        )

        return QRCodeFullScanResponse(
            qr_extraction_success=qr_extraction_success,
            qr_url=qr_url,
            qr_access_key=qr_access_key,
            nfce_fetch_success=True,
            nfce_data=nfce_data,
            message=f"NFCe encontrada: {len(nfce_data.itens)} itens",
        )
    else:
        # NFCe fetch failed
        fallback_suggested = nfce_result.error_type in ('not_available', 'timeout')

        message = nfce_result.error
        if fallback_suggested:
            message += " Recomendamos usar a opção de foto do cupom."

        return QRCodeFullScanResponse(
            qr_extraction_success=qr_extraction_success,
            qr_url=qr_url,
            qr_access_key=qr_access_key,
            nfce_fetch_success=False,
            nfce_error=nfce_result.error,
            nfce_error_type=nfce_result.error_type,
            fallback_suggested=fallback_suggested,
            message=message,
        )


@router.post("/scan-qrcode/extract", response_model=QRCodeExtractionResponse)
async def extract_qrcode(
    data: QRCodeScanRequest,
    current_user: CurrentUser,
):
    """
    Apenas extrai o QR Code da imagem (sem consultar SEFAZ).
    Útil para validar se a imagem contém um QR Code válido de NFCe.
    """
    if not data.image_base64:
        raise HTTPException(
            status_code=400,
            detail="image_base64 é obrigatório para extração de QR Code"
        )

    result = QRCodeService.extract_from_base64(data.image_base64)

    return QRCodeExtractionResponse(
        success=result.is_success,
        url=result.url,
        access_key=result.access_key,
        error=result.error,
    )


@router.post("/scan-qrcode/fetch", response_model=NFCeFetchResponse)
async def fetch_nfce(
    data: QRCodeScanRequest,
    current_user: CurrentUser,
):
    """
    Consulta NFCe na SEFAZ usando URL ou chave de acesso.
    Não processa imagem - use /scan-qrcode para fluxo completo.
    """
    if not data.url and not data.access_key:
        raise HTTPException(
            status_code=400,
            detail="url ou access_key é obrigatório"
        )

    if data.url:
        nfce_result = await NFCeService.fetch_from_url(data.url)
    else:
        nfce_result = await NFCeService.fetch_from_access_key(data.access_key)

    if nfce_result.is_success:
        from app.modules.documents.schemas.qrcode import NFCeDataResponse, NFCeItemResponse

        nfce_data = NFCeDataResponse(
            chave_acesso=nfce_result.data.chave_acesso,
            data_emissao=nfce_result.data.data_emissao,
            cnpj_emitente=nfce_result.data.cnpj_emitente,
            nome_emitente=nfce_result.data.nome_emitente,
            valor_total=float(nfce_result.data.valor_total),
            itens=[
                NFCeItemResponse(
                    codigo=item.codigo,
                    descricao=item.descricao,
                    quantidade=float(item.quantidade),
                    unidade=item.unidade,
                    valor_unitario=float(item.valor_unitario),
                    valor_total=float(item.valor_total),
                    ncm=item.ncm,
                )
                for item in nfce_result.data.itens
            ],
            endereco_emitente=nfce_result.data.endereco_emitente,
            forma_pagamento=nfce_result.data.forma_pagamento,
        )

        return NFCeFetchResponse(
            success=True,
            data=nfce_data,
        )
    else:
        return NFCeFetchResponse(
            success=False,
            error=nfce_result.error,
            error_type=nfce_result.error_type,
            fallback_suggested=nfce_result.error_type in ('not_available', 'timeout'),
        )
