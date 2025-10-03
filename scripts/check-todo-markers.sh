#!/bin/bash
# Check for TODO/FIXME/HACK markers in source code
# Usage: ./scripts/check-todo-markers.sh [--fix]

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🔍 Checking for TODO/FIXME/HACK markers in source code..."

# Search in packages/*/src only (exclude tests, docs, node_modules)
FOUND=$(grep -r "TODO\|FIXME\|HACK\|XXX\|WIP\|TBD" packages/*/src --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist || true)

if [ -n "$FOUND" ]; then
  echo -e "${RED}❌ ERROR: TODO/FIXME/HACK markers found in source code:${NC}"
  echo "$FOUND"
  echo ""
  echo -e "${YELLOW}Please remove or convert to GitHub issues before committing.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ No TODO markers found in source code${NC}"
  exit 0
fi
