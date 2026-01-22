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


async def migrate_credit_card_transactions():
    """Migra transações de cartão para faturas no startup."""
    from sqlalchemy import text
    from datetime import date
    from dateutil.relativedelta import relativedelta

    def calculate_invoice_period(closing_day: int, due_day: int, reference_date: date) -> dict:
        if reference_date.day > closing_day:
            next_month = reference_date + relativedelta(months=1)
            ref_month = next_month.month
            ref_year = next_month.year
        else:
            ref_month = reference_date.month
            ref_year = reference_date.year

        try:
            closing_date = date(ref_year, ref_month, min(closing_day, 28))
        except ValueError:
            closing_date = date(ref_year, ref_month, 28)

        if due_day < closing_day:
            due_date_month = closing_date + relativedelta(months=1)
            try:
                due_date = date(due_date_month.year, due_date_month.month, min(due_day, 28))
            except ValueError:
                due_date = date(due_date_month.year, due_date_month.month, 28)
        else:
            try:
                due_date = date(ref_year, ref_month, min(due_day, 28))
            except ValueError:
                due_date = date(ref_year, ref_month, 28)

        return {
            'reference_month': ref_month,
            'reference_year': ref_year,
            'closing_date': closing_date,
            'due_date': due_date,
        }

    try:
        async with engine.begin() as conn:
            # Verificar se há transações de cartão sem fatura
            result = await conn.execute(text("""
                SELECT COUNT(*) FROM transactions
                WHERE credit_card_id IS NOT NULL AND invoice_id IS NULL
            """))
            pending_count = result.scalar()

            if pending_count == 0:
                return

            print(f"Migrando {pending_count} transações de cartão para faturas...")

            # Buscar transações pendentes
            result = await conn.execute(text("""
                SELECT t.id, t.user_id, t.credit_card_id, t.date, t.amount,
                       cc.closing_day, cc.due_day
                FROM transactions t
                JOIN credit_cards cc ON t.credit_card_id = cc.id
                WHERE t.credit_card_id IS NOT NULL AND t.invoice_id IS NULL
                ORDER BY t.date
            """))
            transactions = result.fetchall()

            invoice_cache = {}
            today = date.today()

            for row in transactions:
                t_id, user_id, card_id, t_date, amount, closing_day, due_day = row
                period = calculate_invoice_period(closing_day, due_day, t_date)
                cache_key = (card_id, period['reference_month'], period['reference_year'])

                if cache_key in invoice_cache:
                    invoice_id = invoice_cache[cache_key]
                else:
                    existing = await conn.execute(text("""
                        SELECT id FROM credit_card_invoices
                        WHERE credit_card_id = :card_id
                          AND reference_month = :month AND reference_year = :year
                    """), {'card_id': card_id, 'month': period['reference_month'], 'year': period['reference_year']})
                    existing_row = existing.fetchone()

                    if existing_row:
                        invoice_id = existing_row[0]
                    else:
                        if period['closing_date'] < today:
                            status = 'overdue' if period['due_date'] < today else 'closed'
                        else:
                            status = 'open'

                        result = await conn.execute(text("""
                            INSERT INTO credit_card_invoices
                            (user_id, credit_card_id, reference_month, reference_year,
                             closing_date, due_date, total_amount, paid_amount, status)
                            VALUES (:user_id, :card_id, :month, :year,
                                    :closing_date, :due_date, 0, 0, :status)
                            RETURNING id
                        """), {
                            'user_id': user_id, 'card_id': card_id,
                            'month': period['reference_month'], 'year': period['reference_year'],
                            'closing_date': period['closing_date'], 'due_date': period['due_date'],
                            'status': status,
                        })
                        invoice_id = result.fetchone()[0]

                    invoice_cache[cache_key] = invoice_id

                await conn.execute(text("""
                    UPDATE transactions SET invoice_id = :invoice_id WHERE id = :t_id
                """), {'invoice_id': invoice_id, 't_id': t_id})

            # Atualizar totais
            await conn.execute(text("""
                UPDATE credit_card_invoices
                SET total_amount = (
                    SELECT COALESCE(SUM(amount), 0) FROM transactions
                    WHERE invoice_id = credit_card_invoices.id
                )
                WHERE id IN (SELECT DISTINCT invoice_id FROM transactions WHERE invoice_id IS NOT NULL)
            """))

            print(f"Migração concluída: {len(transactions)} transações, {len(invoice_cache)} faturas.")

            # Liberar memória do cache após uso
            invoice_cache.clear()

    except Exception as e:
        print(f"Aviso: Migração de transações de cartão falhou: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: em produção usamos Alembic para migrations
    # Não precisamos criar tabelas aqui
    try:
        # Apenas testar a conexão (opcional)
        async with engine.begin() as conn:
            pass

        # Migrar transações de cartão para faturas (se houver pendentes)
        await migrate_credit_card_transactions()
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
# Em desenvolvimento, permitir localhost e rede local. Em produção, usar lista específica.
if settings.debug:
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]
    # Regex para permitir IPs de rede local, localtunnel e cloudflare tunnel (para teste no celular)
    # Aceita HTTP e HTTPS em 192.168.x.x, 10.x.x.x, 172.16-31.x.x nas portas 3000 e 5173
    # Também aceita *.loca.lt e *.trycloudflare.com
    allow_origin_regex = r"^https?://((192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+):(3000|5173)|[\w-]+\.loca\.lt|[\w-]+\.trycloudflare\.com)$"
else:
    allowed_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
    allow_origin_regex = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-API-Key"],
)

# Rotas
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health")
async def health_check():
    return {"status": "ok", "environment": settings.environment}


# Servir frontend em produção
STATIC_DIR = Path(__file__).parent.parent / "static"

print(f"STATIC_DIR: {STATIC_DIR}, exists: {STATIC_DIR.exists()}")

if STATIC_DIR.exists():
    # Listar conteúdo do diretório estático para debug
    print(f"Static directory contents: {list(STATIC_DIR.iterdir())}")

    # Servir assets estáticos (JS, CSS, imagens)
    if (STATIC_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")
        print("Mounted /assets")

    # Servir icons
    if (STATIC_DIR / "icons").exists():
        app.mount("/icons", StaticFiles(directory=STATIC_DIR / "icons"), name="icons")
        print(f"Mounted /icons with files: {list((STATIC_DIR / 'icons').iterdir())}")
    else:
        print("WARNING: /icons directory not found!")

    # Servir logos
    if (STATIC_DIR / "logos").exists():
        app.mount("/logos", StaticFiles(directory=STATIC_DIR / "logos"), name="logos")
        print("Mounted /logos")

    # Servir screenshots (para PWA)
    if (STATIC_DIR / "screenshots").exists():
        app.mount("/screenshots", StaticFiles(directory=STATIC_DIR / "screenshots"), name="screenshots")
        print("Mounted /screenshots")

    # Rotas específicas para arquivos PWA
    @app.get("/manifest.json")
    async def serve_manifest():
        manifest_path = STATIC_DIR / "manifest.json"
        if manifest_path.exists():
            return FileResponse(
                manifest_path,
                media_type="application/json",
                headers={"Cache-Control": "no-cache, must-revalidate"}
            )
        return {"error": "Manifest not found"}

    @app.get("/sw.js")
    async def serve_service_worker():
        sw_path = STATIC_DIR / "sw.js"
        if sw_path.exists():
            return FileResponse(
                sw_path,
                media_type="application/javascript",
                headers={"Cache-Control": "no-cache, must-revalidate"}
            )
        return {"error": "Service worker not found"}

    # Catch-all para SPA - qualquer rota não-API serve o index.html
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # Se for rota de API, não interceptar
        if full_path.startswith("api/") or full_path == "health":
            return None

        # Headers para index.html - não cachear para sempre ter versão mais recente
        no_cache_headers = {"Cache-Control": "no-cache, no-store, must-revalidate"}

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
                    return FileResponse(index_path, headers=no_cache_headers)
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
            return FileResponse(index_path, headers=no_cache_headers)
        return {"error": "Frontend not found"}
