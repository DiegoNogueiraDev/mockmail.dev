#!/bin/bash
# ============================================
# Repository Security Check Script
# MockMail.dev
# ============================================
# Run: ./scripts/security-check-repo.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔒 MockMail.dev - Repository Security Check"
echo "============================================"
echo ""

ISSUES=0

# 1. Check for .env files being tracked
echo "📋 Checking for tracked .env files..."
ENV_FILES=$(git ls-files | grep -E "^\.env$|/\.env$|\.env\.[^e]|\.env\.[^e][^x]" | grep -v "example" || true)
if [ -n "$ENV_FILES" ]; then
    echo -e "${RED}❌ CRITICAL: Real .env files are being tracked:${NC}"
    echo "$ENV_FILES"
    echo -e "${YELLOW}   Run: git rm --cached <file>${NC}"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✅ No real .env files tracked${NC}"
fi

# 2. Check for private keys
echo ""
echo "📋 Checking for private keys..."
KEY_FILES=$(git ls-files | grep -iE "\.key$|\.pem$|id_rsa|id_ed25519|authorized_keys" | grep -v "example\|selfsigned" || true)
if [ -n "$KEY_FILES" ]; then
    echo -e "${RED}❌ CRITICAL: Private key files are being tracked:${NC}"
    echo "$KEY_FILES"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✅ No private keys tracked${NC}"
fi

# 3. Check for hardcoded secrets in code
echo ""
echo "📋 Checking for hardcoded secrets..."
SECRETS=$(git ls-files | xargs grep -l -iE "(password|secret|api_key|token)\s*[=:]\s*['\"][a-zA-Z0-9+/]{20,}['\"]" 2>/dev/null | grep -v node_modules | grep -v "\.md$" | grep -v "\.example" | grep -v "package-lock" | grep -v ".gitleaks" || true)
if [ -n "$SECRETS" ]; then
    echo -e "${YELLOW}⚠️  Potential secrets found in:${NC}"
    echo "$SECRETS"
    echo -e "${YELLOW}   Review these files manually${NC}"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✅ No obvious hardcoded secrets found${NC}"
fi

# 4. Check for MongoDB URIs with passwords
echo ""
echo "📋 Checking for MongoDB URIs with embedded passwords..."
MONGO_PASS=$(git ls-files | xargs grep -l "mongodb.*://[^:]*:[^@]*@" 2>/dev/null | grep -v node_modules | grep -v "\.md$" | grep -v "\.example" || true)
if [ -n "$MONGO_PASS" ]; then
    echo -e "${YELLOW}⚠️  MongoDB URIs with passwords in:${NC}"
    echo "$MONGO_PASS"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✅ No MongoDB URIs with embedded passwords${NC}"
fi

# 5. Check for backup directories
echo ""
echo "📋 Checking for backup directories..."
BACKUP_DIRS=$(git ls-files | grep -iE "^backup-|/backup-|/backups/" || true)
if [ -n "$BACKUP_DIRS" ]; then
    echo -e "${RED}❌ CRITICAL: Backup directories being tracked:${NC}"
    echo "$BACKUP_DIRS"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✅ No backup directories tracked${NC}"
fi

# 6. Check .gitignore exists and has security patterns
echo ""
echo "📋 Checking .gitignore security patterns..."
if [ -f ".gitignore" ]; then
    MISSING_PATTERNS=0
    for pattern in ".env" "*.key" "*.pem" "authorized_keys" "backup-"; do
        if ! grep -q "$pattern" .gitignore; then
            echo -e "${YELLOW}⚠️  Missing pattern in .gitignore: $pattern${NC}"
            MISSING_PATTERNS=$((MISSING_PATTERNS + 1))
        fi
    done
    if [ $MISSING_PATTERNS -eq 0 ]; then
        echo -e "${GREEN}✅ .gitignore has essential security patterns${NC}"
    else
        ISSUES=$((ISSUES + MISSING_PATTERNS))
    fi
else
    echo -e "${RED}❌ CRITICAL: .gitignore file not found!${NC}"
    ISSUES=$((ISSUES + 1))
fi

# 7. Check for gitleaks config
echo ""
echo "📋 Checking for gitleaks configuration..."
if [ -f ".gitleaks.toml" ]; then
    echo -e "${GREEN}✅ .gitleaks.toml exists${NC}"
else
    echo -e "${YELLOW}⚠️  .gitleaks.toml not found - consider adding it${NC}"
fi

# 8. Check for pre-commit config
echo ""
echo "📋 Checking for pre-commit configuration..."
if [ -f ".pre-commit-config.yaml" ]; then
    echo -e "${GREEN}✅ .pre-commit-config.yaml exists${NC}"
else
    echo -e "${YELLOW}⚠️  .pre-commit-config.yaml not found${NC}"
fi

# Summary
echo ""
echo "============================================"
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}🎉 All security checks passed!${NC}"
else
    echo -e "${RED}⚠️  Found $ISSUES security issue(s) to address${NC}"
fi
echo "============================================"

exit $ISSUES
