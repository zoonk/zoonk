import { Prisma } from "./generated/prisma/client";

/**
 * Prisma reports unique constraint races with the `P2002` code. Keeping this
 * check in the database package gives callers one shared guard for idempotent
 * create/upsert flows instead of repeating a loose structural error check.
 */
export function isPrismaUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * `P2003` is a write that names a row another table no longer has, such as a log row for a learner
 * deleted while the work ran.
 */
export function isPrismaForeignKeyError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}
