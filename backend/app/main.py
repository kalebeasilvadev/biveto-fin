from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import engine, Base
from .routers import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: criar tabelas (em produção usar Alembic)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="API para controle financeiro pessoal inteligente",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
allowed_origins = ["*"] if settings.debug else settings.cors_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health")
async def health_check():
    return {"status": "ok", "environment": settings.environment}
