# Makefile for ZeusFi Backend
# Development workflow commands

.PHONY: help setup serve shell createsuperuser celery celery-beat makemigrations migrate lint sync clean docker-up docker-down docker-logs

# Environment variables
DEV_ENV = LOGFIRE_TOKEN=""

# Default target
help:
	@echo "ZeusFi Backend Commands"
	@echo "===================================="
	@echo ""
	@echo "Local Development:"
	@echo "  setup              - Install dependencies with uv"
	@echo "  serve              - Run development server"
	@echo "  shell              - Open Django shell"
	@echo "  createsuperuser    - Create admin superuser"
	@echo "  celery             - Run Celery worker"
	@echo "  celery-beat        - Run Celery beat scheduler"
	@echo ""
	@echo "Database Commands:"
	@echo "  makemigrations     - Create new migrations"
	@echo "  migrate            - Apply migrations"
	@echo ""
	@echo "Docker Commands:"
	@echo "  docker-up          - Start all services (redis, celery)"
	@echo "  docker-down        - Stop all services"
	@echo "  docker-logs        - View docker logs"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint               - Run code linting with ruff"
	@echo "  sync               - Sync dependencies with uv"
	@echo "  clean              - Clean up artifacts"
	@echo ""
	@echo "Examples:"
	@echo "  make setup && make migrate && make serve"
	@echo "  make docker-up && make serve"

# ===========================================
# Local Development Commands
# ===========================================

# Setup - Install all dependencies
setup:
	@echo "Installing dependencies with uv..."
	uv sync --all-groups
	@echo "Setup complete! Run 'make migrate' then 'make serve'"

# Run development server
serve:
	@echo "Starting development server..."
	$(DEV_ENV) uv run python manage.py runserver

# Create migrations
makemigrations:
	@echo "Creating migrations..."
	$(DEV_ENV) uv run python manage.py makemigrations

# Apply migrations
migrate:
	@echo "Applying migrations..."
	$(DEV_ENV) uv run python manage.py migrate

# Open Django shell
shell:
	@echo "Opening Django shell..."
	$(DEV_ENV) uv run python manage.py shell

# Create superuser
createsuperuser:
	@echo "Creating superuser..."
	$(DEV_ENV) uv run python manage.py createsuperuser

# Run Celery worker
celery:
	@echo "Starting Celery worker..."
	$(DEV_ENV) uv run celery -A core worker --loglevel=info --concurrency=4

# Run Celery beat (for scheduled tasks like yield monitoring)
celery-beat:
	@echo "Starting Celery beat scheduler..."
	$(DEV_ENV) uv run celery -A core beat --loglevel=info

# ===========================================
# Docker Commands
# ===========================================

# Start docker services (redis for cache/celery)
docker-up:
	@echo "Starting Docker services..."
	docker compose -f compose.yml up -d redis
	@echo "Redis is running"

# Stop docker services
docker-down:
	@echo "Stopping Docker services..."
	docker compose -f compose.yml down

# View docker logs
docker-logs:
	docker compose -f compose.yml logs -f

# ===========================================
# Code Quality
# ===========================================

# Sync dependencies
sync:
	@echo "Syncing dependencies with uv..."
	uv sync --all-groups
	@echo "Dependencies synced"

# Linting
lint:
	@echo "Linting with ruff..."
	uv run ruff check --fix
	uv run ruff format

# Clean up artifacts
clean:
	@echo "Cleaning up artifacts..."
	rm -rf __pycache__ .pytest_cache .ruff_cache htmlcov .coverage *.pyc
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@echo "Cleanup complete"
