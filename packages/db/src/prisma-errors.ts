import { Prisma } from "./generated/prisma/client";

/**
 * Prisma reports unique constraint races with the `P2002` code. Keeping this
 * check in the database package gives callers one shared guard for idempotent
 * create/upsert flows instead of repeating a loose structural error check.
 */
export function isPrismaUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
