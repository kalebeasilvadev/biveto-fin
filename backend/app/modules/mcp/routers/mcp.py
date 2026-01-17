from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.deps import ApiKeyUser, get_db
from ..schemas import (
    TableListResponse,
    QueryRequest,
    QueryResponse,
    TableStatsResponse,
)
from ..services import MCPService

router = APIRouter(prefix="/mcp", tags=["MCP - Claude Code"])


# OpenAPI Schema para integração com ChatGPT Custom GPTs
OPENAPI_SCHEMA = {
    "openapi": "3.1.0",
    "info": {
        "title": "Biveto MCP API",
        "description": "API para consulta de dados financeiros do Biveto. Use para analisar transações, contas, cartões de crédito, metas e dívidas.",
        "version": "1.0.0",
    },
    "servers": [
        {"url": "https://biveto.com/api/v1"}
    ],
    "paths": {
        "/mcp/tables": {
            "get": {
                "operationId": "listTables",
                "summary": "Lista todas as tabelas disponíveis",
                "description": "Retorna a lista de tabelas que podem ser consultadas, incluindo nome, descrição e colunas de cada uma.",
                "security": [{"ApiKeyAuth": []}],
                "responses": {
                    "200": {
                        "description": "Lista de tabelas",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/TableListResponse"}
                            }
                        }
                    }
                }
            }
        },
        "/mcp/query": {
            "post": {
                "operationId": "queryTable",
                "summary": "Consulta dados de uma tabela",
                "description": "Executa uma consulta em uma tabela específica com filtros opcionais. Os dados são automaticamente filtrados pelo usuário autenticado.",
                "security": [{"ApiKeyAuth": []}],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/QueryRequest"}
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Dados da consulta",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/QueryResponse"}
                            }
                        }
                    }
                }
            }
        },
        "/mcp/summary": {
            "get": {
                "operationId": "getSummary",
                "summary": "Resumo financeiro do usuário",
                "description": "Retorna um resumo geral incluindo: total de contas e saldo, transações do mês, cartões de crédito ativos, faturas em aberto, metas e dívidas.",
                "security": [{"ApiKeyAuth": []}],
                "responses": {
                    "200": {
                        "description": "Resumo financeiro",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/SummaryResponse"}
                            }
                        }
                    }
                }
            }
        },
        "/mcp/tables/{table_name}/stats": {
            "get": {
                "operationId": "getTableStats",
                "summary": "Estatísticas de uma tabela",
                "description": "Retorna contagem de registros e informações sobre uma tabela específica.",
                "security": [{"ApiKeyAuth": []}],
                "parameters": [
                    {
                        "name": "table_name",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Nome da tabela"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Estatísticas da tabela",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/TableStatsResponse"}
                            }
                        }
                    }
                }
            }
        }
    },
    "components": {
        "schemas": {
            "TableListResponse": {
                "type": "object",
                "properties": {
                    "tables": {
                        "type": "array",
                        "description": "Lista de tabelas disponíveis",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string", "description": "Nome da tabela"},
                                "description": {"type": "string", "description": "Descrição da tabela"},
                                "columns": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "name": {"type": "string"},
                                            "description": {"type": "string"}
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "total": {"type": "integer", "description": "Total de tabelas"}
                }
            },
            "QueryRequest": {
                "type": "object",
                "required": ["table"],
                "properties": {
                    "table": {"type": "string", "description": "Nome da tabela (ex: transactions, accounts, credit_cards)"},
                    "filters": {
                        "type": "object",
                        "description": "Filtros no formato {coluna: valor}",
                        "additionalProperties": True
                    },
                    "order_by": {"type": "string", "description": "Coluna para ordenação"},
                    "order_desc": {"type": "boolean", "description": "Se true, ordena descendente", "default": False},
                    "limit": {"type": "integer", "description": "Máximo de resultados (1-1000)", "default": 100},
                    "offset": {"type": "integer", "description": "Offset para paginação", "default": 0}
                }
            },
            "QueryResponse": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "array",
                        "description": "Registros retornados",
                        "items": {
                            "type": "object",
                            "additionalProperties": True
                        }
                    },
                    "total": {"type": "integer", "description": "Total de registros encontrados"},
                    "limit": {"type": "integer", "description": "Limite usado na consulta"},
                    "offset": {"type": "integer", "description": "Offset usado na consulta"}
                }
            },
            "SummaryResponse": {
                "type": "object",
                "properties": {
                    "accounts": {
                        "type": "object",
                        "properties": {
                            "count": {"type": "integer", "description": "Número de contas"},
                            "total_balance": {"type": "number", "description": "Saldo total"}
                        }
                    },
                    "transactions_this_month": {
                        "type": "object",
                        "properties": {
                            "count": {"type": "integer", "description": "Número de transações"},
                            "total_expenses": {"type": "number", "description": "Total de despesas"},
                            "total_income": {"type": "number", "description": "Total de receitas"}
                        }
                    },
                    "credit_cards": {
                        "type": "object",
                        "properties": {
                            "count": {"type": "integer", "description": "Número de cartões ativos"}
                        }
                    },
                    "open_invoices": {
                        "type": "object",
                        "properties": {
                            "count": {"type": "integer", "description": "Número de faturas abertas"},
                            "total_amount": {"type": "number", "description": "Valor total das faturas"}
                        }
                    },
                    "active_goals": {
                        "type": "object",
                        "properties": {
                            "count": {"type": "integer", "description": "Número de metas ativas"},
                            "current_total": {"type": "number", "description": "Valor atual acumulado"},
                            "target_total": {"type": "number", "description": "Valor alvo total"}
                        }
                    },
                    "active_debts": {
                        "type": "object",
                        "properties": {
                            "count": {"type": "integer", "description": "Número de dívidas ativas"},
                            "total_balance": {"type": "number", "description": "Saldo total das dívidas"}
                        }
                    }
                }
            },
            "TableStatsResponse": {
                "type": "object",
                "properties": {
                    "table_name": {"type": "string", "description": "Nome da tabela"},
                    "total_records": {"type": "integer", "description": "Total de registros"},
                    "columns": {
                        "type": "object",
                        "description": "Colunas da tabela com descrições",
                        "additionalProperties": {"type": "string"}
                    }
                }
            }
        },
        "securitySchemes": {
            "ApiKeyAuth": {
                "type": "http",
                "scheme": "bearer",
                "description": "API Key pessoal gerada em Configurações > API Keys. Use o formato: Bearer biv_xxx"
            }
        }
    },
    "security": [{"ApiKeyAuth": []}]
}


@router.get("/openapi.json", include_in_schema=False)
async def get_openapi_schema():
    """
    Retorna o schema OpenAPI para integração com ChatGPT Custom GPTs.
    Este endpoint não requer autenticação.
    """
    return JSONResponse(content=OPENAPI_SCHEMA)


@router.get("/tables", response_model=TableListResponse)
async def list_tables(
    user: ApiKeyUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Lista todas as tabelas disponíveis para consulta.

    **Autenticação**: Header `X-API-Key` com sua API Key pessoal.

    Retorna nome, descrição e colunas de cada tabela acessível.
    """
    service = MCPService(db)
    tables = service.get_table_list()

    return TableListResponse(
        tables=tables,
        total=len(tables),
    )


@router.post("/query", response_model=QueryResponse)
async def query_table(
    request: QueryRequest,
    user: ApiKeyUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Executa uma consulta em uma tabela específica.

    **Autenticação**: Header `X-API-Key` com sua API Key pessoal.

    Os dados são automaticamente filtrados pelo seu usuário.
    Apenas consultas SELECT são permitidas.

    **Parâmetros**:
    - `table`: Nome da tabela (ex: "transactions", "accounts")
    - `filters`: Filtros no formato {"coluna": valor}
    - `order_by`: Coluna para ordenação
    - `order_desc`: Se true, ordena descendente
    - `limit`: Máximo de resultados (1-1000, padrão 100)
    - `offset`: Offset para paginação

    **Exemplo de filtro**:
    ```json
    {
        "table": "transactions",
        "filters": {"type": "expense", "is_paid": true},
        "order_by": "date",
        "order_desc": true,
        "limit": 50
    }
    ```
    """
    service = MCPService(db)
    data, total = await service.query_table(user, request)

    return QueryResponse(
        data=data,
        total=total,
        limit=request.limit,
        offset=request.offset,
    )


@router.get("/tables/{table_name}/stats", response_model=TableStatsResponse)
async def get_table_stats(
    table_name: str,
    user: ApiKeyUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna estatísticas de uma tabela específica.

    **Autenticação**: Header `X-API-Key` com sua API Key pessoal.

    Inclui contagem de registros e informações das colunas.
    """
    service = MCPService(db)
    stats = await service.get_table_stats(user, table_name)

    return TableStatsResponse(**stats)


@router.get("/summary")
async def get_summary(
    user: ApiKeyUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna um resumo geral dos dados financeiros do usuário.

    **Autenticação**: Header `X-API-Key` com sua API Key pessoal.

    Inclui:
    - Total de contas e saldo
    - Transações do mês atual
    - Cartões de crédito ativos
    - Faturas em aberto
    - Metas ativas
    - Dívidas ativas
    """
    service = MCPService(db)
    return await service.get_summary(user)


@router.get("/me")
async def get_current_user_info(
    user: ApiKeyUser,
):
    """
    Retorna informações do usuário autenticado via API Key.

    **Autenticação**: Header `X-API-Key` com sua API Key pessoal.

    Útil para verificar se a autenticação está funcionando.
    """
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "is_active": user.is_active,
    }
