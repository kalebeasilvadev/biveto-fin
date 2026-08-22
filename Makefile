# NOTA: este Makefile é POSIX-only (Linux/Mac/Git Bash). No Windows/PowerShell,
# use os comandos equivalentes documentados em docs/onboarding/01-COMECE-AQUI.md.
.PHONY: help install dev backend frontend docker-up docker-down docker-clean create-admin cleanup-uploads lint mcp-server

# Cores
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
RESET  := $(shell tput -Txterm sgr0)

help: ## Mostra esta ajuda
	@echo ''
	@echo 'Uso:'
	@echo '  ${YELLOW}make${RESET} ${GREEN}<alvo>${RESET}'
	@echo ''
	@echo 'Alvos:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  ${YELLOW}%-15s${RESET} %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ==================== Instalação ====================

install: ## Instala dependências do backend e frontend
	@echo "Instalando dependências do backend..."
	cd backend && python -m venv venv && . venv/bin/activate && pip install -r requirements.txt
	@echo "Instalando dependências do frontend..."
	cd frontend && npm install

# ==================== Desenvolvimento ====================

dev: ## Inicia backend e frontend em desenvolvimento
	@echo "Iniciando em modo desenvolvimento..."
	@make -j2 backend frontend

backend: ## Inicia o backend (FastAPI)
	cd backend && cp -n .env.example .env 2>/dev/null || true
	cd backend && . venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend: ## Inicia o frontend (Vite)
	cd frontend && npm run dev

# ==================== Docker ====================

docker-up: ## Inicia containers Docker (PostgreSQL)
	docker-compose up -d
	@echo "PostgreSQL: localhost:5433 (mapeado para nao colidir com Postgres local)"

docker-down: ## Para containers Docker
	docker-compose down

docker-clean: ## Remove containers, volumes e imagens não utilizados
	docker-compose down -v
	docker system prune -f

docker-logs: ## Mostra logs dos containers
	docker-compose logs -f

# ==================== Banco de Dados ====================

db-migrate: ## Cria nova migração Alembic
	cd backend && . venv/bin/activate && alembic revision --autogenerate -m "$(msg)"

db-upgrade: ## Aplica migrações
	cd backend && . venv/bin/activate && alembic upgrade head

db-reset: ## Reseta banco de dados (SQLite)
	rm -f backend/biveto.db
	cd backend && . venv/bin/activate && python -c "from app.main import *; import asyncio; asyncio.run(engine.dispose())"

# ==================== Testes ====================

test: ## Executa testes do backend
	cd backend && . venv/bin/activate && pytest

test-cov: ## Executa testes com cobertura
	cd backend && . venv/bin/activate && pytest --cov=app --cov-report=html

lint: ## Roda linters (ruff no backend, eslint no frontend) — o mesmo que o CI cobra
	cd backend && . venv/bin/activate && ruff check app/
	cd frontend && npm run lint

# ==================== MCP Server ====================

mcp-server: ## Inicia o servidor MCP (read-only, consome a API — requer backend rodando e BIVETO_API_KEY)
	cd mcp-biveto-db && pip install -q -r requirements.txt && python server.py

# ==================== Build ====================

build-frontend: ## Builda o frontend para produção
	cd frontend && npm run build

# ==================== Limpeza ====================

clean: ## Remove arquivos temporários
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name dist -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/venv 2>/dev/null || true

cleanup-uploads: ## Remove uploads com mais de 30 dias (uso: make cleanup-uploads [DAYS=30] [DRY_RUN=1])
	cd backend && . venv/bin/activate && python scripts/cleanup_uploads.py --days $(or $(DAYS),30) $(if $(DRY_RUN),--dry-run,)

# ==================== Admin ====================

create-admin: ## Cria usuário admin (uso: make create-admin email=x senha=y nome=z)
	cd backend && . venv/bin/activate && python scripts/create_admin.py "$(email)" "$(senha)" "$(nome)"
