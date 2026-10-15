# LnkShrt backend

Express 5 API written in strict TypeScript, using Prisma 7 / PostgreSQL, Redis, and BullMQ. The existing authentication, links, analytics, QR uploads, temporary links, domain records, and donation endpoints are retained.

## Requirements

- Node.js 24 LTS recommended (minimum 22.18)
- PostgreSQL
- Redis
- Existing credentials for the integrations you use: Google OAuth, Brevo, Cloudinary, IP geolocation, and Razorpay

## Development

1. Copy `.env.example` to `.env` and fill in your existing configuration. The original environment variable names are preserved, including `BRAVO_API_KEY` and `CLOUDNARY_*`.
2. Run `npm ci` to install dependencies and generate Prisma Client.
3. For a new database, or to apply previously existing migrations, run `npx prisma migrate deploy`. The TypeScript conversion itself adds no database migration.
4. Run `npm run dev`.

The API defaults to port 8080. Health check: `GET /health-check`.

## Production

```sh
npm ci
npm run build
npm start
```

The build compiles both the application and the generated Prisma client into `dist/`. `npm start` runs `dist/src/index.js`. Configure your host's build command as `npm run build` and start command as `npm start`, and install development dependencies during the build so the compiler is available. Keep the existing production environment variables.

## Checks

```sh
npm run typecheck
npm test
```

`npm test` builds first and runs HTTP regression tests against the compiled application, plus JWT tests. HTTP tests isolate database, Redis, email queue, and geolocation dependencies. Coverage includes authentication/cookies, validation, redirects, password protection, ownership, pagination, and multipart QR uploads. The Node test runner uses its experimental module-mocking flag.

### PostgreSQL and Redis integration tests

Use a dedicated local PostgreSQL database whose name contains `test`, and Redis database 15. The suite rejects remote hosts and removes only its own uniquely named test records and keys; it never flushes a database. Supply these variables in your shell (the test process does not load `.env`):

```sh
export DATABASE_URL=postgresql://backend_test:backend_test@127.0.0.1:5432/backend_test
export REDIS_URL=redis://127.0.0.1:6379/15
npx prisma migrate deploy
npm run test:integration
```

The integration suite exercises real Prisma/PostgreSQL persistence, unique short-code constraints, search/pagination, owner-only edits/deletes, hashed refresh sessions and rotation/revocation, OTP verification, and Redis temporary-link expiration. Email delivery and geolocation are mocked; no paid third-party calls are made.

### GitHub Actions

`Backend CI` runs on every pull request, pushes to `main`, and manual dispatch:

- Node 22 and 24: clean dependency install, strict application/test type checks, production build, HTTP and JWT tests.
- Node 24 with disposable PostgreSQL 16 and Redis 7 service containers: apply all committed migrations to an empty database, build, and run integration tests.
- JUnit reports are uploaded for 14 days, including on test failures. Jobs have a ten-minute timeout and superseded runs are cancelled.

No repository secrets are required. `npm run test:ci` and `npm run test:integration:ci` are report-producing commands that expect `npm run build` to have run first. External OAuth, email, uploads, geolocation, and payments still need staging verification.

## TypeScript layout

- `src/index.ts`: server and shutdown handling
- `src/app.ts`: Express middleware and existing route mounts
- `src/controllers/`, `src/routes/`, `src/services/`: existing feature structure
- `src/types/`: request metadata, service payloads, and SQL result types
- `src/validators/`: Zod validation and inferred input types
- `generated/prisma/`: generated TypeScript client; ignored by Git

Relative source imports intentionally use `.js` so the compiled files resolve under Node ESM. TypeScript resolves these imports to their `.ts` sources during development and compilation.

## Migration notes

Existing API paths, cookie names, response envelopes, and database tables remain in place. Corrections made while enabling strict types:

- Restore the missing paginated `GET /api/v1/links` service. It returns `{ links, pagination: { page, limit, total, totalPages } }` inside the existing response envelope and omits password hashes.
- Forward missing/inactive redirect errors to the error handler and remove undefined debug counters.
- Scope link password changes to the signed-in user.
- Narrow query parameters, JWT payloads, optional uploads, and nullable passwords.
- Preserve the optional registration name during validation.
- Correct the CORS `allowedHeaders` option and Multer error callback signature.
- Handle optional geolocation fields and Cloudinary cleanup errors.
- Give BullMQ plain Redis connection options to avoid mismatched ioredis class types.
- Close the HTTP server, worker, queue, Redis client, and Prisma during shutdown.

Bio-page APIs and DNS domain verification are documented below.

## Docker

```sh
cp .env.example .env
# Set your secrets and integration credentials in .env.
docker compose up --build -d
```

The API is available at `http://localhost:8080`. Compose starts PostgreSQL and Redis, waits for health checks, applies migrations in a one-shot container, and starts the API as a non-root user. It overrides DATABASE_URL and REDIS_URL to the internal service names. Database ports are not exposed to the host; persistent named volumes retain data across restarts. The default PostgreSQL password is for local development; set `POSTGRES_PASSWORD` for your environment (URL-encode reserved characters if needed).

```sh
docker compose logs -f api
docker compose down
```

`down` preserves data. Only use `docker compose down --volumes` when you intend to erase this stack's data.

For hosting, build `docker build --target runtime -t utpx-backend .`. The runtime contains compiled JS and production dependencies, excludes `.env`, and uses the container health check. Supply environment variables at runtime. Run the separate `migrate` image target once per deployment before starting the runtime; do not run migrations on every replica startup. Termination signals reach Node directly. Configure HTTPS at your hosting/reverse-proxy layer.

## Custom domains and bio pages

See [the frontend API contract](docs/bio-domains-api.md) for endpoints, payloads, publishing, DNS records, and hosting requirements. This release adds a database migration for bio pages and changes domain deletion to protect associated links. Apply migrations before deploying the new code.

CI also builds the Docker stack, applies migrations, checks HTTP health, and verifies that the API runs without root. Integration tests use real PostgreSQL/Redis and deterministic DNS responses; unit tests exercise TXT/CNAME matching and DNS error handling. Public DNS propagation and hosting TLS must be checked with your actual domain when configured.
