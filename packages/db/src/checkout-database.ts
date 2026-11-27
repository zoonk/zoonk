import { realpathSync } from "node:fs";
import { isLinkedWorktree, worktreeDatabasePrefix } from "#local-database-names";
import { parse } from "pg-connection-string";
import { currentCheckout } from "./local-database";

const LOCAL_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

/**
 * A `DATABASE_URL` in the shell outranks a worktree's env files, so it can send the worktree's
 * seeds, migrations and servers to another checkout's database. Remote hosts are left alone.
 */
export function requireCheckoutDatabase(
  connectionString: string,
  checkout = currentCheckout(),
): string {
  if (!isLinkedWorktree(checkout)) {
    return connectionString;
  }

  // pg's own parser, so query parameters such as `?host=` or `?port=` count as pg counts them.
  const { database, host } = parse(connectionString);
  const prefix = worktreeDatabasePrefix(realpathSync(checkout));
  const name = database ?? "";
  const local = !host || host.startsWith("/") || LOCAL_HOSTS.has(host.toLowerCase());

  if (!local || name.startsWith(prefix)) {
    return connectionString;
  }

  throw new Error(
    `This worktree's database is ${prefix}dev, but DATABASE_URL or DATABASE_URL_UNPOOLED names the local database ${name}, which isn't this worktree's. Unset DATABASE_URL and DATABASE_URL_UNPOOLED in your shell, or run pnpm worktree:setup if the worktree has no database yet.`,
  );
}
