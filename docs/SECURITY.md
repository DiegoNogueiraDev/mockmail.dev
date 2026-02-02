# 🔒 Security Policy - MockMail.dev

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by:
1. **DO NOT** create a public GitHub issue
2. Email the maintainers directly with details
3. Allow reasonable time for a fix before disclosure

## Security Practices

### Environment Variables

All sensitive configuration MUST be in environment variables:

```bash
# ❌ NEVER do this
const secret = "hardcoded-secret-value";

# ✅ Always do this
const secret = process.env.JWT_SECRET;
```

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing key (64+ chars) | `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | Refresh token key | `openssl rand -base64 64` |
| `CSRF_SECRET` | CSRF protection key | `openssl rand -base64 32` |
| `MONGO_PASSWORD` | MongoDB password | Strong password |
| `REDIS_PASSWORD` | Redis password | Strong password |

### File Security

Files that should **NEVER** be committed:
- `.env` (any real environment file)
- `*.key`, `*.pem` (private keys)
- `id_rsa*`, `authorized_keys` (SSH keys)
- `credentials.json`, `service-account*.json`
- Backup directories with production data

### Pre-commit Hooks

Install pre-commit hooks to catch secrets before committing:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

### Gitleaks

Scan for secrets in the repository:

```bash
# Install gitleaks
# macOS: brew install gitleaks
# Linux: go install github.com/gitleaks/gitleaks/v8@latest

# Scan current state
gitleaks detect --source . --config .gitleaks.toml

# Scan git history
gitleaks detect --source . --config .gitleaks.toml --log-opts="--all"
```

### Security Checklist for Pull Requests

- [ ] No hardcoded secrets
- [ ] Environment variables used for all sensitive data
- [ ] No private keys or certificates committed
- [ ] No backup files with production data
- [ ] Input validation on all user inputs
- [ ] SQL/NoSQL injection prevention
- [ ] XSS prevention (sanitize-html used)
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] Authentication required for sensitive endpoints

## Dependencies

Regularly check for vulnerable dependencies:

```bash
# Backend
cd backend && npm audit

# Frontend
cd frontend && npm audit
```

## Server Security

See [docs/SERVER-SECURITY-GUIDE.md](docs/SERVER-SECURITY-GUIDE.md) for:
- SSH hardening
- Firewall configuration
- Fail2ban setup
- Automatic updates
- Monitoring and alerting
