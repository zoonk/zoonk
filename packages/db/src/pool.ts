import { Pool } from "pg";

const CONNECTION_TIMEOUT_MS = 10_000;
const MAX_CONNECTIONS = 10;

/**
 * `next build` prerenders on many workers at once, each with its own pool: at 10 connections each,
 * their first queries open over a hundred connections in the same moment, which can overflow the
 * queue of connections Postgres has yet to accept, and the reset ones fail the build.
 */
const BUILD_MAX_CONNECTIONS = 2;

/** The driver's pool shared by Prisma and Vercel's request-lifetime hook. */
export function createDatabasePool(connectionString: string | undefined) {
  /** Fluid reuses concurrent connections; bound both socket setup and waiting for a free client. */
  return new Pool({
    connectionString,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    max:
      process.env.NEXT_PHASE === "phase-production-build" ? BUILD_MAX_CONNECTIONS : MAX_CONNECTIONS,
  });
}
