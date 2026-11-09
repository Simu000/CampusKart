# Campus Exchange (basic version)

## Run it
**Backend** (Java 17+, Maven): `cd backend && mvn spring-boot:run`  -> http://localhost:8080
Uses a local H2 file database by default. For PostgreSQL set `DB_URL`, `DB_USER`, `DB_PASS`.
Other env vars: `JWT_SECRET`, `UNIVERSITY_EMAIL_DOMAINS` (e.g. `example.edu`; empty = any email, dev only), `CORS_ORIGIN`.

**Frontend** (Node 18+): `cd frontend && npm install && npm run dev` -> http://localhost:5173 (proxies /api to :8080)

## Included
Register/login (JWT, BCrypt, configurable email domain) - categories (seeded) - create/browse/search/filter/paginate/remove listings (SELL/RENT/LEND)
- requests: send, accept (row-locked stock reservation), decline, cancel (releases stock), complete (seller) - chat on accepted requests (polling)
- server-side ownership and participant checks.

## Next steps (from the spec)
Email verification + password reset - image upload to object storage - mutual completion confirmation - request expiry (72h)
- notifications - block/report - admin dashboard + audit logs - Flyway migrations - rate limiting - HTTP-only cookie auth - tests.
