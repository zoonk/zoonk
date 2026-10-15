import { Pool } from "pg";

const CONNECTION_TIMEOUT_MS = 10_000;
const MAX_CONNECTIONS = 10;

/** The driver's pool shared by Prisma and Vercel's request-lifetime hook. */
export function createDatabasePool(connectionString: string | undefined) {
  /** Fluid reuses concurrent connections; bound both socket setup and waiting for a free client. */
  return new Pool({
    connectionString,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    max: MAX_CONNECTIONS,
  });
}
