# Liftit Project Assessment

This document summarizes the potential issues and risks identified while reviewing the Liftit codebase.

## Authentication & Security

- **Insecure development credentials**: The NextAuth credentials provider is hard-coded with a demo username/password and is automatically enabled in development. This is acceptable for local testing but represents a significant security risk if the `NODE_ENV` check were to fail or be misconfigured during deployment. Additionally, the sign-in page defaults to these demo credentials when the form fields are left empty, which could leak unintended access if deployed as-is. 【F:app/api/auth/[...nextauth]/route.ts†L71-L124】【F:app/auth/signin/page.tsx†L33-L87】
- **Mixed environment variable names**: OAuth providers are configured to read `GITHUB_ID`, `GITHUB_SECRET`, `GOOGLE_ID`, `GOOGLE_SECRET`, etc., while the `.env.example` file documents `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. This mismatch will break Google authentication when developers follow the example file. 【F:app/api/auth/[...nextauth]/route.ts†L57-L101】【F:.env.example†L1-L6】
- **Sign-in redirect inconsistency**: The root page redirects unauthenticated users to `/api/auth/signin`, but NextAuth is configured to use the custom `/auth/signin` route. Hitting the API endpoint directly can yield a 405 response or bypass the styled login experience. 【F:app/page.tsx†L1-L16】【F:app/api/auth/[...nextauth]/route.ts†L141-L148】
- **Sign-out link uses GET**: The header renders an anchor to `/api/auth/signout`. NextAuth expects a POST request or use of the `signOut` helper, so this link may silently fail under stricter CSRF settings. 【F:app/layout.tsx†L36-L55】

## Data Layer & Configuration

- **Database configuration mismatch**: Prisma is configured to use SQLite (`file:./dev.db`), yet `.env.example` guides developers toward PostgreSQL and references a `DATABASE_URL`. Attempting to run migrations with the provided schema against PostgreSQL without adjustments will fail. 【F:prisma/schema.prisma†L1-L67】【F:.env.example†L1-L6】
- **Unnecessary dependency duplication**: The project installs both `@auth/prisma-adapter` and `@next-auth/prisma-adapter`, but only the former is used. Keeping both increases install time and may cause version skew. 【F:package.json†L13-L38】
- **Session provider without initial session**: The root layout fetches the server session but does not pass it to `<SessionProvider>`, so the client has to refetch the session via an extra network request. While functional, this adds latency and can cause hydration flashes. 【F:app/layout.tsx†L1-L61】【F:app/providers.tsx†L1-L7】

## Developer Experience & Reliability

- **Lack of automated tests or linting guidance**: The repository does not include unit/integration tests or CI configuration. Introducing automated testing would help prevent regressions in workout logging and analytics flows. (Observation from project structure.)
- **Potential repeated demo-user creation**: The `createDemoUserIfNotExists` helper runs at module scope; in serverless environments it can execute on every cold start, spamming logs and potentially racing on writes. Wrapping this in a proper bootstrap hook or seed script would be safer. 【F:app/api/auth/[...nextauth]/route.ts†L10-L47】

## Recommendations

1. Remove hard-coded demo credentials from production builds and gate all demo logic behind environment flags.
2. Align environment variable documentation with the keys used in code (e.g., rename to `GOOGLE_ID`/`GOOGLE_SECRET` or update the code to match `GOOGLE_CLIENT_ID`).
3. Update navigation to use NextAuth helpers (`signIn`, `signOut`) and ensure redirects hit the custom authentication pages.
4. Consolidate database guidance—either commit to SQLite for development or provide the appropriate Prisma schema for PostgreSQL.
5. Clean up unused dependencies and introduce automated testing/checks to improve maintainability.
6. Move demo user seeding to a dedicated script invoked via `prisma db seed` rather than on every route import.
