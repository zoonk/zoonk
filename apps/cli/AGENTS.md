# CLI

`pnpm zoonk` runs `src/main.ts` straight from source with Node's type stripping, with no build step. Using it on production data follows [zoonk-staff-data](../../.agents/skills/zoonk-staff-data/SKILL.md).

- Erasable TypeScript only (no enums, namespaces or parameter properties), and local imports keep their `.ts` extension; `tsconfig.json` enforces both.
- No runtime dependencies: the CLI holds production credentials, and a later phase publishes it on npm for learners and organizations.
- Data commands print only JSON on stdout. Messages and errors go to stderr, with the exit codes `src/help.ts` lists. Never print a token.
- Every request goes through `sendRequest` in `src/http.ts`, which never follows a redirect and never prints a request's own error text: either could carry a token.
- Every read-then-write of a login goes through `changeLogin` in `src/credentials.ts`, one SQLite `BEGIN IMMEDIATE` transaction from the read to the save. A rotated refresh token sent again past the provider's reuse window (`REFRESH_TOKEN_REUSE_SECONDS` in `packages/auth/src/plugins/cli-login.ts`) ends every CLI login of that person; within it, the provider answers with the same new pair.
- The OAuth client id, scopes and endpoint paths live in `src/oauth.ts`; the staff routes in `src/args.ts` match the API's `apps/api/src/app/staff` routes.
