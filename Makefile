# Witsmith — full project runner
# Usage: make <target>

WITSMITH_DIR := apps/cli/witsmith
DEMO_REPO    := apps/cli/witsmith/demo-repo
CORE_DIR     := apps/core
BACKEND_DIR  := apps/backend
FRONTEND_DIR := apps/frontend

# ── setup ─────────────────────────────────────────────────────────────────────

.PHONY: install
install: ## Install all JS dependencies and Python CLI deps
	npm install
	cd $(CORE_DIR) && npm install
	cd $(BACKEND_DIR) && npm install
	cd $(FRONTEND_DIR) && npm install
	cd $(WITSMITH_DIR) && uv sync

.PHONY: db-setup
db-setup: ## Create SQLite schema for core memory layer
	cd $(CORE_DIR) && npx prisma db push && npx prisma generate

# ── demo session flow ─────────────────────────────────────────────────────────

.PHONY: demo-init
demo-init: ## Initialize Witsmith in the demo repo
	cd $(WITSMITH_DIR) && uv run witsmith init --cwd demo-repo

.PHONY: demo-session
demo-session: ## Run a full demo session (start → test → finish)
	cd $(WITSMITH_DIR) && uv run witsmith start "Fix OAuth redirect bug" --cwd demo-repo
	cd $(WITSMITH_DIR) && uv run witsmith run "npm test" --cwd demo-repo
	cd $(WITSMITH_DIR) && uv run witsmith finish --cwd demo-repo

.PHONY: demo-import
demo-import: db-setup ## Import latest demo session into SQLite and generate memory cards
	cd $(CORE_DIR) && npx ts-node src/test-run.ts

.PHONY: demo-context
demo-context: ## Get Witsmith context for a new task
	cd $(WITSMITH_DIR) && uv run witsmith context "Add refresh-token validation" --cwd demo-repo

.PHONY: demo
demo: demo-init demo-session demo-import demo-context ## Run full demo flow end to end

# ── dev servers ───────────────────────────────────────────────────────────────

.PHONY: start
start: ## Start everything: frontend, backend, and witsmith-server in parallel
	npx concurrently \
		--names "frontend,backend,witsmith" \
		--prefix-colors "cyan,green,yellow" \
		"cd $(FRONTEND_DIR) && npm run dev" \
		"cd $(BACKEND_DIR) && npm run dev" \
		"cd $(WITSMITH_DIR) && uv run witsmith-server"

.PHONY: backend
backend: db-setup ## Start the backend API server (port 3001)
	cd $(BACKEND_DIR) && npm run dev

.PHONY: frontend
frontend: ## Start the frontend dev server
	cd $(FRONTEND_DIR) && npm run dev

.PHONY: witsmith-server
witsmith-server: ## Start the Witsmith MCP server
	cd $(WITSMITH_DIR) && uv run witsmith-server

# ── tests & checks ────────────────────────────────────────────────────────────

.PHONY: test
test: ## Run core unit tests
	cd $(CORE_DIR) && npm test

.PHONY: typecheck
typecheck: ## Type check core and backend
	cd $(CORE_DIR) && npx tsc --noEmit
	cd $(BACKEND_DIR) && npx tsc --noEmit

.PHONY: benchmark
benchmark: ## Run the core pipeline benchmark
	cd $(CORE_DIR) && npx ts-node src/benchmark.ts

.PHONY: test-cli
test-cli: ## Run Witsmith CLI pytest suite
	cd $(WITSMITH_DIR) && uv run pytest tests/ -v

.PHONY: smoke
smoke: ## Run Witsmith CLI smoke tests
	cd $(WITSMITH_DIR) && uv run witsmith scaffold --cwd .
	cd $(WITSMITH_DIR) && uv run witsmith run "npm test" --cwd demo-repo --no-exec
	cd $(WITSMITH_DIR) && uv run ruff check src scripts

# ── utilities ─────────────────────────────────────────────────────────────────

.PHONY: kill-ports
kill-ports: ## Kill anything running on ports 3001 and 5173
	-lsof -t -i:3001 | xargs kill -9 2>/dev/null
	-lsof -t -i:5173 | xargs kill -9 2>/dev/null

.PHONY: db-studio
db-studio: ## Open Prisma Studio to inspect the database
	cd $(CORE_DIR) && npx prisma studio

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
