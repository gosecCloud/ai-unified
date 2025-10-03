#!/bin/bash
# Check for pre-release and vulnerable dependencies
# Usage: ./scripts/check-dependencies.sh

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🔍 Auditing dependencies..."

# 1. Check for high/critical vulnerabilities
echo ""
echo "1️⃣ Checking for security vulnerabilities..."
if pnpm audit --audit-level=high --prod 2>&1 | grep -q "vulnerabilities"; then
  echo -e "${RED}❌ High/critical vulnerabilities found${NC}"
  pnpm audit --audit-level=high --prod
  exit 1
else
  echo -e "${GREEN}✅ No high/critical vulnerabilities${NC}"
fi

# 2. Check for pre-release versions in production dependencies
echo ""
echo "2️⃣ Checking for pre-release versions..."
PRERELEASE=$(pnpm list --prod --depth=999 2>/dev/null | grep -E 'beta|alpha|rc|dev' || true)
if [ -n "$PRERELEASE" ]; then
  echo -e "${YELLOW}⚠️  WARNING: Pre-release dependencies found:${NC}"
  echo "$PRERELEASE"
  echo ""
  echo -e "${YELLOW}Consider upgrading to stable versions before production deployment.${NC}"
  # Don't fail - just warn
else
  echo -e "${GREEN}✅ No pre-release versions in production dependencies${NC}"
fi

# 3. Check for deprecated packages
echo ""
echo "3️⃣ Checking for deprecated packages..."
DEPRECATED=$(pnpm list --depth=999 2>&1 | grep "deprecated" || true)
if [ -n "$DEPRECATED" ]; then
  echo -e "${YELLOW}⚠️  WARNING: Deprecated packages found:${NC}"
  echo "$DEPRECATED"
  echo ""
  echo -e "${YELLOW}Consider upgrading or replacing deprecated packages.${NC}"
  # Don't fail - just warn
else
  echo -e "${GREEN}✅ No deprecated packages${NC}"
fi

echo ""
echo -e "${GREEN}✅ Dependency audit complete${NC}"
