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

/** A transaction conflict rolls back every write and may be retried from its beginning. */
export function isPrismaTransactionConflictError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code === "P2034") {
    return true;
  }

  const adapterError = error.meta?.driverAdapterError;

  if (error.code !== "P2010" || !(adapterError instanceof Error)) {
    return false;
  }

  const cause = adapterError.cause;

  /** Raw queries in the pg adapter carry the PostgreSQL conflict code inside P2010. */
  return (
    typeof cause === "object" &&
    cause !== null &&
    "originalCode" in cause &&
    (cause.originalCode === "40P01" || cause.originalCode === "40001")
  );
}
