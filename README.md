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

`npm test` builds first and exercises the compiled application's HTTP routes with isolated database, Redis, email queue, and geolocation dependencies. It does not send email, charge payments, or connect to a production database. The Node test runner uses its experimental module-mocking flag. Live database and third-party integration checks still require a configured environment.

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

Bio pages and the other planned product upgrades are separate work.
