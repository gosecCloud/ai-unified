#!/bin/bash
# Check for placeholder data in production code
# Usage: ./scripts/check-placeholders.sh

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🔍 Checking for placeholder data in source code..."

# Patterns that indicate placeholder/mock data
PATTERNS=(
  "example\.com"
  "PLACEHOLDER"
  "CHANGEME"
  "REPLACEME"
  "your-api-key-here"
  "sk-proj-mock"
  "test-api-key-123"
)

FOUND=""
for pattern in "${PATTERNS[@]}"; do
  # Search in packages/*/src only (exclude tests, examples, CLI output)
  MATCHES=$(grep -r "$pattern" packages/*/src --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist --exclude="*.test.ts" --exclude="*.spec.ts" 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    FOUND="${FOUND}\n${MATCHES}"
  fi
done

if [ -n "$FOUND" ]; then
  echo -e "${RED}❌ ERROR: Placeholder data found in source code:${NC}"
  echo -e "$FOUND"
  echo ""
  echo -e "${YELLOW}Replace with production-safe defaults or environment variables.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ No placeholder data found in source code${NC}"
  exit 0
fi
