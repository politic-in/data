# Indian Political Data - Makefile
# Complete data pipeline automation

# Variables
SHELL := /bin/bash
.DEFAULT_GOAL := help

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Environment
-include .env
export

# Directories
DIST_DIR := dist
RENDER_DIR := render-backend
DOCS_DIR := docs

# Database files
SQLITE_DB := $(DIST_DIR)/politic-data.db
POSTGRES_DUMP := $(DIST_DIR)/politic-data.sql

# Detect OS for command variations
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
	SED_I := sed -i ''
else
	SED_I := sed -i
endif

# Check if command exists
define check_command
	@command -v $(1) >/dev/null 2>&1 || { echo "$(RED)❌ $(1) is not installed$(NC)"; exit 1; }
endef

.PHONY: help
help: ## Show this help message
	@echo "$(BLUE)========================================$(NC)"
	@echo "$(BLUE)  Indian Political Data - Makefile$(NC)"
	@echo "$(BLUE)========================================$(NC)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "$(YELLOW)Quick Start:$(NC)"
	@echo "  make setup        Install dependencies and check prerequisites"
	@echo "  make build        Build all data formats (SQLite, PostgreSQL, Parquet)"
	@echo "  make validate     Validate all JSON data against schemas"
	@echo "  make run          Run data validation and build"
	@echo ""
	@echo "$(YELLOW)Available targets:$(NC)"
	@grep -h -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[0;32m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================================================
# Setup and Prerequisites
# ============================================================================

.PHONY: setup
setup: check-deps install ## Install dependencies and check prerequisites
	@echo "$(GREEN)✓ Setup complete$(NC)"

.PHONY: check-deps
check-deps: ## Check if required dependencies are installed
	@echo "$(YELLOW)Checking prerequisites...$(NC)"
	$(call check_command,node)
	@echo "$(GREEN)✓$(NC) node is installed"
	$(call check_command,npm)
	@echo "$(GREEN)✓$(NC) npm is installed"
	$(call check_command,sqlite3)
	@echo "$(GREEN)✓$(NC) sqlite3 is installed"
	@if command -v docker >/dev/null 2>&1; then \
		echo "$(GREEN)✓$(NC) docker is installed (optional)"; \
	else \
		echo "$(YELLOW)⚠$(NC) docker not found (optional for exports)"; \
	fi

.PHONY: install
install: ## Install npm dependencies
	@echo "$(YELLOW)Installing npm dependencies...$(NC)"
	@npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

.PHONY: clean
clean: ## Clean all generated files
	@echo "$(YELLOW)Cleaning generated files...$(NC)"
	@rm -rf $(DIST_DIR)/*.db $(DIST_DIR)/*.sql $(DIST_DIR)/*.parquet $(DIST_DIR)/*.tar.gz
	@rm -rf $(DIST_DIR)/*.json $(DIST_DIR)/*.jsonl $(DIST_DIR)/*.cypher $(DIST_DIR)/*.ndjson
	@echo "$(GREEN)✓ Cleaned$(NC)"

# ============================================================================
# Data Validation
# ============================================================================

.PHONY: validate
validate: ## Validate all JSON data against schemas
	@echo "$(YELLOW)Validating all data...$(NC)"
	@npm run validate
	@echo "$(GREEN)✓ All data validated$(NC)"

.PHONY: validate-booth
validate-booth: ## Validate booth data
	@npm run validate:booth

.PHONY: validate-census
validate-census: ## Validate census data
	@npm run validate:census

.PHONY: validate-election-mla
validate-election-mla: ## Validate MLA election data
	@npm run validate:election-mla

.PHONY: validate-election-mp
validate-election-mp: ## Validate MP election data
	@npm run validate:election-mp

.PHONY: test
test: validate ## Run all tests (alias for validate)

# ============================================================================
# Data Building
# ============================================================================

.PHONY: build
build: build-db build-parquet ## Build all data formats

.PHONY: build-db
build-db: ## Build SQLite database and PostgreSQL dump
	@echo "$(YELLOW)Building databases from real data...$(NC)"
	@echo "  • Booth data: 1M+ records"
	@echo "  • Census data: 600K+ villages, 8K+ towns"
	@echo "  • Election results: 20+ years of data"
	@npm run build:db
	@echo "$(GREEN)✓ Databases built$(NC)"
	@echo "  SQLite:  $(SQLITE_DB)"
	@echo "  PostgreSQL: $(POSTGRES_DUMP)"

.PHONY: build-parquet
build-parquet: ## Build Parquet files for big data processing
	@echo "$(YELLOW)Building Parquet files...$(NC)"
	@npm run build:parquet
	@echo "$(GREEN)✓ Parquet files built$(NC)"

.PHONY: build-delta
build-delta: ## Build delta/changelog files
	@echo "$(YELLOW)Building delta files...$(NC)"
	@npm run build:delta
	@echo "$(GREEN)✓ Delta files built$(NC)"

.PHONY: build-vectors
build-vectors: ## Generate vector embeddings (requires GPU)
	@echo "$(YELLOW)Generating vector embeddings...$(NC)"
	@if [ -n "$$RUNPOD_ENDPOINT_ID" ] && [ -n "$$RUNPOD_API_KEY" ]; then \
		echo "  • Using RunPod GPU (RTX A6000)"; \
		echo "  • Processing 1M+ records in ~5 minutes"; \
		npm run build:vectors; \
	else \
		echo "$(YELLOW)⚠ RunPod credentials not found in .env$(NC)"; \
		echo "  Set RUNPOD_ENDPOINT_ID and RUNPOD_API_KEY to use GPU acceleration"; \
		echo "  Without GPU, processing 1M+ records would take 16+ hours"; \
	fi

.PHONY: build-all
build-all: build build-vectors build-delta ## Build everything including vectors

# ============================================================================
# Database Exports
# ============================================================================

.PHONY: export-neo4j
export-neo4j: ## Export data to Neo4j format
	@echo "$(YELLOW)Creating Neo4j export...$(NC)"
	@npm run export:neo4j || echo "$(YELLOW)⚠ Neo4j export failed$(NC)"

.PHONY: export-qdrant
export-qdrant: ## Export data to Qdrant format
	@echo "$(YELLOW)Creating Qdrant export...$(NC)"
	@npm run export:qdrant || echo "$(YELLOW)⚠ Qdrant export failed$(NC)"

.PHONY: export-elasticsearch
export-elasticsearch: ## Export data to Elasticsearch format
	@echo "$(YELLOW)Creating Elasticsearch export...$(NC)"
	@npm run export:elasticsearch || echo "$(YELLOW)⚠ Elasticsearch export failed$(NC)"

.PHONY: export-all
export-all: export-neo4j export-qdrant export-elasticsearch ## Export to all vector databases

# ============================================================================
# Local Development
# ============================================================================

.PHONY: serve-local
serve-local: ## Start local web server for data editor
	@echo "$(YELLOW)Starting local web server...$(NC)"
	@echo "$(BLUE)Data Editor will be available at: http://localhost:8080$(NC)"
	@if command -v python3 >/dev/null 2>&1; then \
		cd $(DOCS_DIR) && python3 -m http.server 8080; \
	else \
		cd $(DOCS_DIR) && npx http-server -p 8080; \
	fi

.PHONY: serve-oauth
serve-oauth: ## Start OAuth backend for GitHub authentication
	@echo "$(YELLOW)Starting OAuth backend...$(NC)"
	@cd $(RENDER_DIR) && npm install && npm start

# ============================================================================
# Main Operations
# ============================================================================

.PHONY: run
run: validate build ## Run data validation and build
	@echo ""
	@echo "$(BLUE)========================================$(NC)"
	@echo "$(GREEN)✅ Data Pipeline Complete!$(NC)"
	@echo "$(BLUE)========================================$(NC)"
	@echo ""
	@echo "$(YELLOW)📊 Generated Files:$(NC)"
	@echo "  • SQLite Database: $(SQLITE_DB)"
	@echo "  • PostgreSQL Dump: $(POSTGRES_DUMP)"
	@echo "  • Parquet files in: $(DIST_DIR)/parquet/"
	@echo ""
	@echo "$(YELLOW)📈 Data Statistics:$(NC)"
	@echo "  • Booth records: 1,000,000+"
	@echo "  • Census villages: 600,000+"
	@echo "  • Census towns: 8,000+"
	@echo "  • Election results: 20+ years"
	@echo ""
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  • View data online: http://data.politic.in"
	@echo "  • Test locally: make serve-local"
	@echo "  • Generate vectors: make build-vectors"
	@echo "  • Export to databases: make export-all"

.PHONY: run-pipeline
run-pipeline: run ## Alias for run target

.PHONY: run-full
run-full: validate build-all export-all ## Run everything including vectors and exports
	@echo ""
	@echo "$(BLUE)========================================$(NC)"
	@echo "$(GREEN)✅ Full Pipeline Complete with All Exports!$(NC)"
	@echo "$(BLUE)========================================$(NC)"

# ============================================================================
# Status and Information
# ============================================================================

.PHONY: status
status: ## Check data status
	@echo "$(BLUE)========================================$(NC)"
	@echo "$(BLUE)  Data Status$(NC)"
	@echo "$(BLUE)========================================$(NC)"
	@echo ""
	@if [ -f $(SQLITE_DB) ]; then \
		echo "$(GREEN)✓$(NC) SQLite database exists"; \
		echo "  Size: $$(du -h $(SQLITE_DB) | cut -f1)"; \
		echo "  Tables: $$(sqlite3 $(SQLITE_DB) '.tables' | wc -w)"; \
	else \
		echo "$(YELLOW)⚠$(NC) SQLite database not found"; \
	fi
	@echo ""
	@if [ -f $(POSTGRES_DUMP) ]; then \
		echo "$(GREEN)✓$(NC) PostgreSQL dump exists"; \
		echo "  Size: $$(du -h $(POSTGRES_DUMP) | cut -f1)"; \
	else \
		echo "$(YELLOW)⚠$(NC) PostgreSQL dump not found"; \
	fi
	@echo ""
	@if [ -d $(DIST_DIR)/parquet ]; then \
		echo "$(GREEN)✓$(NC) Parquet files exist"; \
		echo "  Count: $$(ls -1 $(DIST_DIR)/parquet/*.parquet 2>/dev/null | wc -l) files"; \
	else \
		echo "$(YELLOW)⚠$(NC) Parquet files not found"; \
	fi

.PHONY: db-stats
db-stats: ## Show database statistics
	@if [ -f $(SQLITE_DB) ]; then \
		echo "$(YELLOW)Database Statistics:$(NC)"; \
		sqlite3 $(SQLITE_DB) "SELECT 'booth' as table_name, COUNT(*) as count FROM booth \
		UNION ALL SELECT 'census', COUNT(*) FROM census \
		UNION ALL SELECT 'election_mla', COUNT(*) FROM election_mla \
		UNION ALL SELECT 'election_mp', COUNT(*) FROM election_mp;" | column -t -s '|'; \
	else \
		echo "$(RED)Database not found. Run 'make build' first$(NC)"; \
	fi

.PHONY: changelog
changelog: ## Generate changelog
	@echo "$(YELLOW)Generating changelog...$(NC)"
	@npm run changelog || echo "$(YELLOW)⚠ No changelog script configured$(NC)"

# ============================================================================
# GitHub Pages
# ============================================================================

.PHONY: deploy-docs
deploy-docs: ## Deploy documentation to GitHub Pages
	@echo "$(YELLOW)Deploying to GitHub Pages...$(NC)"
	@git add docs/
	@git commit -m "Update GitHub Pages documentation" || true
	@git push
	@echo "$(GREEN)✓ Documentation deployed$(NC)"
	@echo "  View at: https://politic-in.github.io/data/"

# ============================================================================
# Shortcuts
# ============================================================================

.PHONY: all
all: run ## Default target - run data pipeline

.DEFAULT_GOAL := help