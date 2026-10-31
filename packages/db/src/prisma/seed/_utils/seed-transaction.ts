/**
 * The seed writes every learner at once over one pool, so on a slower machine a transaction can
 * wait for a connection longer than Prisma's default two seconds.
 */
export const SEED_TRANSACTION = { maxWait: 30_000, timeout: 30_000 } as const;
