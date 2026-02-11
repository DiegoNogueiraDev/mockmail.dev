# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-10

### Added

#### Email Features
- **SMTP Headers**: Raw email headers extraction and display (DKIM, SPF, X-headers)
- **Email Threading**: Automatic conversation grouping via `In-Reply-To` / `References` headers
- **Email Forwarding**: Forward received emails to external addresses (rate limited: 10/day)
- **Auto-Forward Rules**: Per-mailbox rules with optional from/subject filters (max 3/box)

#### Platform
- **API Playground**: Interactive API testing directly from documentation page
- **SDKs**: Official Node.js (`@mockmail/sdk`) and Python (`mockmail-sdk`) SDKs
- **Email Notifications**: Configurable alerts on email receipt (instant/hourly/daily digest)
- **Status Page**: Real-time system health monitoring at `/status`
- **FAQ Section**: 8-question FAQ accordion on landing page

#### Admin Panel
- Admin dashboard with interactive charts and statistics
- User management with search, detail pages, and session tracking
- Mailbox management with batch operations
- Redis caching layer for all admin routes

#### Infrastructure
- Redis cache with intelligent invalidation
- User session tracking (login/logout history)
- Landing page redesign with WCAG AAA+ accessibility
- Shimmer skeleton loaders for improved perceived performance

### Changed
- Backend version bumped from 1.0.0 to 2.0.0
- Frontend version bumped from 0.1.0 to 2.0.0
- Email processing pipeline now extracts headers, threading fields, and triggers notifications

### Security
- Complete security audit with 5+ rounds of fixes
- Internal API token validation hardening
- Rate limiting on Postfix email intake
- HTML email sanitization to prevent XSS
- MongoDB and Redis bound to localhost
- FIFO permissions restricted
- CSRF protection on mutating endpoints
- Mongoose CastError handling to prevent information leaks

### Fixed
- Email deduplication via `messageId` unique sparse index
- Expired mailbox reactivation on incoming email
- Legacy boxes without `expiresAt` treated as expired after 24h
- Refresh token verification using correct secret
- Tailwind v4 skeleton class circular reference
- Postfix smtpd crash blocking external emails
- Frontend register page response handling

## [1.0.0] - 2026-01-15

### Added
- Initial release
- Temporary email box creation via API
- Email receiving and storage (MongoDB)
- RESTful API with JWT authentication
- Next.js 15 frontend dashboard
- Webhook notifications
- Email processor (TypeScript) via PM2
- Postfix integration for email receiving

[2.0.0]: https://github.com/DiegoNogueiraDev/mockmail.dev/compare/v1.0...v2.0.0
[1.0.0]: https://github.com/DiegoNogueiraDev/mockmail.dev/releases/tag/v1.0
