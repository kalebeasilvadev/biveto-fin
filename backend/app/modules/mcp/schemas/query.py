from pydantic import BaseModel, Field
from typing import Any


class ColumnInfo(BaseModel):
    """Informações de uma coluna"""
    name: str
    description: str


class TableInfo(BaseModel):
    """Informações de uma tabela"""
    name: str
    description: str
    columns: list[ColumnInfo]


class TableListResponse(BaseModel):
    """Lista de tabelas disponíveis"""
    tables: list[TableInfo]
    total: int


class QueryRequest(BaseModel):
    """Requisição de query"""
    table: str = Field(..., description="Nome da tabela para consultar")
    filters: dict[str, Any] | None = Field(None, description="Filtros no formato {coluna: valor}")
    order_by: str | None = Field(None, description="Coluna para ordenação")
    order_desc: bool = Field(False, description="Ordenar descendente")
    limit: int = Field(100, ge=1, le=1000, description="Limite de resultados")
    offset: int = Field(0, ge=0, description="Offset para paginação")


class QueryResponse(BaseModel):
    """Resposta de query"""
    data: list[dict[str, Any]]
    total: int
    limit: int
    offset: int


class TableStatsResponse(BaseModel):
    """Estatísticas de uma tabela"""
    table: str
    total_records: int
    columns: dict[str, dict[str, Any]]  # {coluna: {distinct_count, sample_values, etc}}
