# Running the app locally

Nothing needs an environment variable. Read the section for what you're starting.

## Which server

- **`pnpm start` is what you verify, review and walk personas on.** It builds every app, or only the ones you name (`pnpm start api` for a native app's walk), and serves the production builds, which is what learners get: a dev server compiles on demand and shows loading states they never see. Sign-in and the mailbox work as in `pnpm dev`.
- **`pnpm dev` is for hot reload while you change UI.** It starts the apps and the mailbox; name apps to start only those (`pnpm dev main api`). Stop it before `pnpm start`, since both register the same routes, then check the result on `pnpm start`.
- Use the URLs the command prints: both serve through clone- and worktree-scoped Portless routes. `pnpm dev:lan` serves another device, `pnpm dev:direct` uses direct ports, and `pnpm dev:prune` stops orphaned servers. A stack's services stop within seconds of its `pnpm dev` or `pnpm start` ending, even when that process is force-killed.
- Each app's `start:app` is the bare `next start`, which E2E servers run on their own ports. Outside `pnpm start` and E2E, a production build counts as a deployment, so local sign-in refuses it.

## Sign-in

Use an account from `packages/db/src/prisma/seed/users.ts`, such as `owner@zoonk.test`, or a new `@zoonk.test` address. Request an OTP and read the newest message for that address in the local mailbox. A learner at a chosen point of a plan comes from `pnpm dev:persona` ([persona passes](../skills/zoonk-persona-walkthrough/references/passes.md)).

## Databases

- With PostgreSQL 18 running, `pnpm install` then `pnpm db:setup` prepare any checkout. In the primary checkout or a fresh clone, `db:setup` creates `zoonk`, `zoonk_test` and `zoonk_e2e` when they're missing (seeding new ones), applies migrations to all three and writes the seed's Library to an existing `zoonk` again when they or the seed changed. It connects as `postgres:postgres@localhost:5432` unless `packages/db/.env` names another local server. It never replaces a database it didn't create, and it rebuilds only one its own interrupted run left unfinished.
- In a new linked worktree, run `pnpm worktree:setup` before database-dependent work; worktrees that Codex, Claude Code, or T3 Code with the imported `t3.json` Setup action create already ran it. Keep the generated local database overrides, so migrations, integration tests and E2E tests stay isolated.
- A worktree's development copy starts as a snapshot of the primary checkout's `zoonk`, which can be behind. Setup, `pnpm dev` and `pnpm start` apply the checkout's migrations to the worktree's own copy, then write the seed's Library to it again when the migrations or seed changed. So pulling a branch with new migrations or seed changes needs only a restart, and the seed's hand-written lessons stay written after a migration that resets stored lessons.
- Setup drops the database copies of removed worktrees and of those idle for a week; rerun it to restore a worktree's expired copies.

## AI Gateway and Blob

AI Gateway (everything that generates) and Vercel Blob (learners' uploads, generated pictures and audio) sign in with the app's Vercel OIDC token, which refreshes itself; there is no AI key or Blob read-write token.

- In the primary checkout, run `vercel link` once in `apps/main` (project `zoonk`), `apps/api` (`zoonk-api`) and `apps/evals` (`zoonk`, since evals has no project of its own) and stay signed in to the Vercel CLI. `pnpm worktree:setup` copies the links into worktrees.
- For Blob, also set the store ids each app's `.env.example` lists in its `.env` (scripts read only that file).
- Leave `AI_GATEWAY_API_KEY` unset on these machines, since a key wins over the login. Without access to Zoonk's Vercel team, set your own `AI_GATEWAY_API_KEY` in each app's `.env` instead; cloud agents use the development key ([cloud agents](cloud-agents.md)).
