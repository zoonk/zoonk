/**
 * The seed writes every learner at once over one connection pool, so a transaction can wait for a
 * free connection longer than Prisma's default two seconds on a slower machine, such as CI's
 * runners. The seed never runs on a request path, so it waits instead of failing.
 */
export const SEED_TRANSACTION = { maxWait: 30_000, timeout: 30_000 } as const;
