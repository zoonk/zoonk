# Database schema and generated client

- Generate migrations with `pnpm --filter @zoonk/db db:migrate --name <migration-name>`; do not handwrite them. Regenerate the Prisma client (`pnpm --filter @zoonk/db db:generate`) after schema changes.
- Production migrates before the new apps go live, so the release still running reads the new schema, and Prisma names every column of a model in its queries. To remove a column that release reads, drop its constraints and mark the field `@ignore` (the client stops reading and writing it; migrations keep it), then remove the field in a release after that one.

Prisma's schema and generated types are the source of truth. Export model types needed by consumers from `src/index.ts`; do not maintain manual copies of generated model shapes. For queries in this package or its consumers, use the shared [Prisma guidance](../../.agents/guides/prisma.md).
