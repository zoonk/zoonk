import { Prisma } from "./generated/prisma/client";

const MAX_QUERY_ITEMS = 100;

export function clampQueryItems(count: number): number {
  return Math.min(Math.max(count, 1), MAX_QUERY_ITEMS);
}

/**
 * Check if an error is a Prisma unique constraint violation (P2002).
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
