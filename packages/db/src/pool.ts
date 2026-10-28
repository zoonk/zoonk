import { createWriteStream } from "node:fs";
import { Pool } from "pg";

const CONNECTION_TIMEOUT_MS = 10_000;
const MAX_CONNECTIONS = 10;

/**
 * `next build` prerenders on many workers at once, each with its own pool: at 10 connections each,
 * their first queries open over a hundred connections in the same moment, which can overflow the
 * queue of connections Postgres has yet to accept, and the reset ones fail the build.
 */
const BUILD_MAX_CONNECTIONS = 2;

type Run = (...args: unknown[]) => unknown;

/** A statement's SQL, given as text or as a query config. */
function sqlOf(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  return value && typeof value === "object" && "text" in value && typeof value.text === "string"
    ? value.text
    : undefined;
}

function rowCountOf(value: unknown): number | null {
  return value &&
    typeof value === "object" &&
    "rowCount" in value &&
    typeof value.rowCount === "number"
    ? value.rowCount
    : null;
}

/**
 * For verification only (`pnpm verify:pages --queries`): appends each statement's SQL, start,
 * duration and row count to `file` as a JSON line, never its parameters, so a page's database work
 * can be counted and its query plans checked. Without `ZOONK_QUERY_LOG` the pool is untouched.
 */
function logQueries(pool: Pool, file: string) {
  const log = createWriteStream(file, { flags: "a" });

  pool.on("connect", (client) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- pg's overloads, called as they came.
    const run = client.query.bind(client) as Run;

    const query: Run = (...args) => {
      const sql = sqlOf(args[0]);
      const at = performance.timeOrigin + performance.now();
      const started = performance.now();

      const write = (value: unknown) =>
        log.write(
          `${JSON.stringify({ at, ms: performance.now() - started, rows: rowCountOf(value), sql })}\n`,
        );

      // The pool's own `query()` (Prisma's reads) hands the client a callback; transactions await.
      const callback = args.at(-1);

      if (typeof callback === "function") {
        return run(...args.slice(0, -1), (error: unknown, value: unknown) => {
          if (!error) {
            write(value);
          }

          Reflect.apply(callback, undefined, [error, value]);
        });
      }

      const result = run(...args);

      if (result instanceof Promise) {
        result.then(write, () => null);
      }

      return result;
    };

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The same overloads, timed.
    client.query = query as typeof client.query;
  });
}

/** The driver's pool shared by Prisma and Vercel's request-lifetime hook. */
export function createDatabasePool(connectionString: string | undefined) {
  /** Fluid reuses concurrent connections; bound both socket setup and waiting for a free client. */
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    max:
      process.env.NEXT_PHASE === "phase-production-build" ? BUILD_MAX_CONNECTIONS : MAX_CONNECTIONS,
  });

  if (process.env.ZOONK_QUERY_LOG) {
    logQueries(pool, process.env.ZOONK_QUERY_LOG);
  }

  return pool;
}
