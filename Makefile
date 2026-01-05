.PHONY: help install dev backend frontend docker-up docker-down docker-clean

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
	@echo "PostgreSQL: localhost:5432"

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
	rm -f backend/financeiro.db
	cd backend && . venv/bin/activate && python -c "from app.main import *; import asyncio; asyncio.run(engine.dispose())"

# ==================== Testes ====================

test: ## Executa testes do backend
	cd backend && . venv/bin/activate && pytest

test-cov: ## Executa testes com cobertura
	cd backend && . venv/bin/activate && pytest --cov=app --cov-report=html

# ==================== MCP Server ====================

mcp-server: ## Inicia o servidor MCP para integração com assistentes IA
	cd backend && . venv/bin/activate && python mcp_server.py

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
