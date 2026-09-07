# Database schema and generated client

- Generate migrations with `pnpm --filter @zoonk/db db:migrate --name <migration-name>`; do not handwrite them. Regenerate the Prisma client after schema changes.

Prisma's schema and generated types are the source of truth. Export model types needed by consumers from `src/index.ts`; do not maintain manual copies of generated model shapes. For queries in this package or its consumers, use the shared [Prisma guidance](../../.agents/guides/prisma.md).
