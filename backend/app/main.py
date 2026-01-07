from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .core.config import settings
from .core.database import engine, Base
from .core.rate_limit import limiter, rate_limit_exceeded_handler
from .routers import api_router


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware para adicionar headers de segurança HTTP"""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Headers de segurança
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # HSTS apenas em produção (HTTPS)
        if not settings.debug:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: em produção usamos Alembic para migrations
    # Não precisamos criar tabelas aqui
    try:
        # Apenas testar a conexão (opcional)
        async with engine.begin() as conn:
            pass
    except Exception as e:
        # Se falhar conexão no startup, continuar mesmo assim
        # O app pode se recuperar quando o banco estiver disponível
        print(f"Aviso: Conexão inicial com banco falhou: {e}")
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="API para controle financeiro pessoal inteligente",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Headers de segurança (adicionar antes do CORS)
app.add_middleware(SecurityHeadersMiddleware)

# CORS - mais restritivo
# Em desenvolvimento, permitir localhost. Em produção, usar lista específica.
if settings.debug:
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]
else:
    allowed_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Rotas
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health")
async def health_check():
    return {"status": "ok", "environment": settings.environment}


# Servir frontend em produção
STATIC_DIR = Path(__file__).parent.parent / "static"

if STATIC_DIR.exists():
    # Servir assets estáticos (JS, CSS, imagens)
    if (STATIC_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    # Servir icons
    if (STATIC_DIR / "icons").exists():
        app.mount("/icons", StaticFiles(directory=STATIC_DIR / "icons"), name="icons")

    # Rotas específicas para arquivos PWA
    @app.get("/manifest.json")
    async def serve_manifest():
        manifest_path = STATIC_DIR / "manifest.json"
        if manifest_path.exists():
            return FileResponse(manifest_path, media_type="application/json")
        return {"error": "Manifest not found"}

    @app.get("/sw.js")
    async def serve_service_worker():
        sw_path = STATIC_DIR / "sw.js"
        if sw_path.exists():
            return FileResponse(sw_path, media_type="application/javascript")
        return {"error": "Service worker not found"}

    # Catch-all para SPA - qualquer rota não-API serve o index.html
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # Se for rota de API, não interceptar
        if full_path.startswith("api/") or full_path == "health":
            return None

        # Proteção contra path traversal
        # Resolve o caminho e verifica se está dentro de STATIC_DIR
        try:
            file_path = (STATIC_DIR / full_path).resolve()
            static_dir_resolved = STATIC_DIR.resolve()

            # Verificar se o caminho resolvido está dentro do diretório permitido
            if not str(file_path).startswith(str(static_dir_resolved)):
                # Tentativa de path traversal detectada
                index_path = STATIC_DIR / "index.html"
                if index_path.exists():
                    return FileResponse(index_path)
                return {"error": "Not found"}

            # Verificar se é um arquivo estático existente
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
        except (ValueError, OSError):
            # Caminho inválido
            pass

        # Caso contrário, servir index.html para SPA routing
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"error": "Frontend not found"}
