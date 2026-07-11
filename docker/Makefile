.PHONY: help setup up down logs shell restart status clean

help:
	@echo "BuildMate OpenClaw Docker commands:"
	@echo "  make setup       - Initialize .env + config"
	@echo "  make up          - Start OpenClaw gateway"
	@echo "  make down        - Stop containers"
	@echo "  make logs        - View logs"
	@echo "  make restart     - Restart service"
	@echo "  make shell       - SSH into container"
	@echo "  make status      - Check health"
	@echo "  make clean       - Remove containers (keep data)"

setup:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✓ .env created"; \
	else \
		echo "✓ .env exists"; \
	fi
	@bash generate-config.sh

up:
	docker compose up -d
	@echo "✓ OpenClaw starting..."
	@echo "  http://localhost:18789"
	@sleep 3
	@docker compose logs openclaw-gateway | tail -3

down:
	docker compose down

logs:
	docker compose logs -f openclaw-gateway

shell:
	docker compose exec openclaw-gateway /bin/sh

restart:
	docker compose restart openclaw-gateway

status:
	docker compose ps
	@echo ""
	@-docker compose exec -T openclaw-gateway curl -s http://localhost:18789/api/v1/gateway/status | jq . 2>/dev/null || echo "⏳ OpenClaw starting..."

clean:
	docker compose down
	@echo "✓ Containers stopped (data kept in volumes)"
