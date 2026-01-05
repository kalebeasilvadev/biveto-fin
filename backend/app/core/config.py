from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    # Use SQLite para dev: sqlite+aiosqlite:///./financeiro.db
    # Use PostgreSQL para prod: postgresql+asyncpg://user:pass@host/db
    database_url: str = "sqlite+aiosqlite:///./financeiro.db"
    use_sqlite: bool = True  # Detectado automaticamente pela URL

    # JWT
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # App
    debug: bool = True
    environment: str = "development"
    app_name: str = "App Financeiro"
    api_v1_prefix: str = "/api/v1"

    # CORS - origens permitidas (separadas por vírgula)
    cors_origins: str = "http://localhost:3000,https://app-financeiro-web.fly.dev"

    # Document Processing
    max_upload_size_mb: int = 10
    allowed_extensions: list[str] = ["jpg", "jpeg", "png", "pdf"]

    # Storage
    upload_dir: str = "./uploads"

    # LLM/Vision API (para OCR inteligente)
    # Providers suportados: openai, google, anthropic
    vision_provider: str = "google"  # google é gratuito!
    openai_api_key: str | None = None
    google_api_key: str | None = None  # Gemini - GRÁTIS
    anthropic_api_key: str | None = None
    vision_model: str = "gemini-2.0-flash"  # Modelo gratuito com visão (atualizado 2025)

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
