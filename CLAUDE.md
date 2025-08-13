# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the Indian Political Data repository containing structured political datasets including booth data, census information, election results (MLA/MP), and geographical data. The repository serves as a public data source with automated validation, publishing, and a web-based editor.

## Essential Commands

### Development & Validation
```bash
# Install dependencies (Node v22.16.0 required)
npm install

# Validate all JSON data against schemas
npm run validate

# Validate specific data type
npm run validate:booth
npm run validate:census
npm run validate:election-mla
npm run validate:election-mp

# Run validation before any commit
npm test  # Same as npm run validate

# Run complete local stack
make run          # Run data validation and build
make run-pipeline # Alias for run (data pipeline)
make run-full     # Everything including vectors and exports
make help         # Show all available commands
```

### Building Data Packages
```bash
# Build all databases (SQLite, PostgreSQL, Parquet)
npm run build

# Build individual formats
npm run build:db         # Creates SQLite database and PostgreSQL dump
npm run build:parquet    # Creates Parquet files
npm run build:delta      # Creates delta/changelog with only changes
npm run build:vectors    # Generate vector embeddings with GPU

# Export to vector databases
npm run export:neo4j         # Export to Neo4j with vector indexes
npm run export:qdrant       # Export to Qdrant vector database
npm run export:elasticsearch # Export to Elasticsearch

# Generate changelog between releases
npm run changelog
```

### GPU-Accelerated Vector Processing
```bash
# Set RunPod credentials (RTX A6000 GPU)
export RUNPOD_ENDPOINT_ID="your-endpoint-id"
export RUNPOD_API_KEY="your-api-key"

# Run vector generation (processes 1M+ records in < 5 minutes)
npm run build:vectors
```
- Uses RunPod.io with RTX A6000 (48GB VRAM)
- Processes 10,000 texts per batch, 4 parallel requests
- Achieves 5000+ embeddings/second (320x faster than CPU)
- Total cost < $5 for entire dataset

### Local Testing of Web Editor
```bash
# IMPORTANT: Cannot test by opening HTML directly due to CORS
# Must use a local HTTP server:

# Option 1: Python
python3 serve-local.py

# Option 2: Node.js  
node serve-local.js

# Then open http://localhost:8080
```

## Architecture & Key Components

### Data Structure
The repository follows a hierarchical structure where all political data is organized by type and state:
- **Data files**: `{data-type}/{state}/{files}.json`
- **Schemas**: Define strict validation rules using JSON Schema v7
- **State codes**: Use format like "S01" (State) or "U07" (Union Territory)

### Validation System
- **AJV-based validation**: Uses `ajv` with `ajv-formats` for comprehensive JSON Schema validation
- **Schema enforcement**: Every data type has a corresponding schema in `/schemas/`
- **Case-insensitive state codes**: Patterns accept both uppercase and lowercase (e.g., "S01" or "s01")
- **GitHub Actions integration**: Automatic validation on PRs and main branch commits

### CI/CD Pipeline

#### PR Validation (`validate-json.yml`)
- Triggers on any JSON data or schema changes
- Only validates changed data types for efficiency
- Posts validation results as PR comments
- Creates GitHub issues on main branch failures

#### Weekly Publishing (`publish-data.yml`)
- Runs Saturday nights at 11:30 PM UTC
- Checks for changes before publishing
- Creates two releases: Full data and Delta-only
- Generates SQLite, PostgreSQL, and Parquet formats
- Includes checksums for verification

### Web Editor Architecture
- **Frontend**: Pure HTML/JS with Bootstrap 5 and Tabulator.js
- **Data Grid**: Tabulator for table visualization and editing
- **GitHub API**: Direct API calls for fetching repository contents
- **Authentication**: GitHub OAuth (requires backend service for token exchange)
- **Important**: Uses `app-simple.js` currently due to ES module/CORS issues with Octokit

### Critical Configuration Points

#### Repository Settings
- **Owner**: `politic-in`
- **Repository name**: `data` (NOT `politic-data`)
- **GitHub Pages**: Deployed from `/docs` folder on main branch
- **CODEOWNERS**: All paths owned by `admin@politic.in`

#### Web Editor Config (`docs/assets/js/app.js`)
```javascript
const CONFIG = {
    owner: 'politic-in',
    repo: 'data',  // Critical: Must be 'data' not 'politic-data'
    branch: 'main'
};
```

## Schema Validation Rules

### Common Patterns
- **State codes**: `^[SUsU][0-9]{2}$` (accepts S/s/U/u prefix)
- **District codes**: Typically 3-digit strings
- **Assembly constituencies**: Numeric with specific ranges per state
- **Required fields**: Each schema enforces mandatory fields like IDs, names, and codes

### Data Type Specifics
- **booth**: Polling station data with part numbers and location details
- **census**: Demographic data with population statistics
- **election-mla**: State assembly election results
- **election-mp**: Lok Sabha election results

## Common Issues & Solutions

### Web Editor Not Working Locally
- **Problem**: Opening `file:///path/to/index.html` shows frozen dropdowns
- **Solution**: Must use HTTP server due to CORS restrictions with GitHub API
- **Fix**: Run `python3 serve-local.py` or `node serve-local.js`

### Schema Validation Failures
- **Puducherry issue**: Uses "U07" (Union Territory) not "S" prefix
- **Case sensitivity**: Some entries use lowercase 's' - schemas updated to handle both
- **Fix**: Check schemas allow `[SUsU]` pattern for state codes

### Node.js Compatibility
- **Required version**: Node v22.16.0
- **better-sqlite3**: Must use v11.5.0 or higher for Node v22
- **Fix**: Update package.json dependencies if npm install fails

## GitHub Actions Secrets Required
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions
- No additional secrets needed for current workflows

## Release Strategy
- **Full releases**: Complete dataset in multiple formats
- **Delta releases**: Only changed records since last release
- **Versioning**: Date-based (YYYY.MM.DD)
- **Frequency**: Weekly on Saturdays if changes detected

## Important Notes for Future Development

1. **Always validate before committing**: Run `npm run validate` locally
2. **Repository name confusion**: Local folder is `politic-data` but GitHub repo is `data`
3. **Web editor limitations**: Currently read-only; edit functionality requires OAuth backend
4. **CORS restrictions**: GitHub API calls only work from http/https, not file:// protocol
5. **Schema updates**: Any schema change requires testing against existing data
6. **PR workflow**: All changes should go through PRs for automatic validation
7. **Data ownership**: All paths owned by admin@politic.in per CODEOWNERS