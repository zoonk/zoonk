# Prisma queries

Use these conventions wherever Prisma is queried, including core capabilities, app-specific administration, authentication, and test fixtures. Query style does not change the repository's ownership or authorization boundaries.

- Return full small Prisma models by default. Use `omit` for unused large fields such as `Step.content`, `Step.visualContent`, `StepAttempt.answer`, and `StepAttempt.effects`; use `include` for relations and `select` on a relation when only specific fields are needed.
- Use generated Prisma types or derive a query result type. Export missing model types from `packages/db/src/index.ts` instead of maintaining manual query-shape types.

For schema changes and migration generation, follow [database package instructions](../../packages/db/AGENTS.md).
