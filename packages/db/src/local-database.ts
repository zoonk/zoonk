import { realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type DatabaseMode,
  LOCAL_DATABASE_NAMES,
  isLinkedWorktree,
  worktreeDatabaseName,
  worktreeDatabasePrefix,
} from "#local-database-names";

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);
const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

/** Target overrides bypass the authority/path check, including pg and libpq connection options. */
const CONNECTION_TARGET_PARAMETERS = new Set([
  "connectionstring",
  "database",
  "db",
  "dbname",
  "host",
  "hostaddr",
  "port",
  "service",
]);

const DEVELOPMENT_DATABASE_NAME = /^zoonk(?:_wt_[a-f0-9]{12}_dev)?$/u;

function findCheckout(directory: string): string {
  const parent = dirname(directory);

  if (parent === directory || statSync(join(directory, ".git"), { throwIfNoEntry: false })) {
    return directory;
  }

  return findCheckout(parent);
}

function currentCheckout(): string {
  // Turbopack leaves out import.meta.dirname in the bundled server.
  return findCheckout(import.meta.dirname ?? process.cwd());
}

/** `scripts/cloud/setup.sh` gives Debian's `postgres` role this password. */
export function getLocalDatabaseUrl(
  mode: DatabaseMode = "dev",
  checkout = currentCheckout(),
): string {
  const name = isLinkedWorktree(checkout)
    ? worktreeDatabaseName({ mode, worktree: realpathSync(checkout) })
    : LOCAL_DATABASE_NAMES[mode];

  return `postgres://postgres:postgres@localhost:5432/${name}`;
}

export function getDatabaseUrl(environment: NodeJS.Dict<string> = process.env): string {
  return environment.DATABASE_URL || getLocalDatabaseUrl();
}

/** Migrations need a direct connection, which deployments name apart from the pooled one. */
export function getUnpooledDatabaseUrl(environment: NodeJS.Dict<string> = process.env): string {
  return environment.DATABASE_URL_UNPOOLED || getDatabaseUrl(environment);
}

/** The database a URL names on this machine; undefined when it may connect elsewhere. */
function localDatabaseName(connectionString: string): string | undefined {
  if (!URL.canParse(connectionString)) {
    return undefined;
  }

  const url = new URL(connectionString);

  if (
    !POSTGRES_PROTOCOLS.has(url.protocol) ||
    !LOCAL_DATABASE_HOSTS.has(url.hostname) ||
    [...url.searchParams.keys()].some((key) => CONNECTION_TARGET_PARAMETERS.has(key.toLowerCase()))
  ) {
    return undefined;
  }

  try {
    return decodeURIComponent(url.pathname.replace(/^\//u, ""));
  } catch {
    return undefined;
  }
}

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

  const name = localDatabaseName(connectionString);
  const prefix = worktreeDatabasePrefix(realpathSync(checkout));

  if (name === undefined || name.startsWith(prefix)) {
    return connectionString;
  }

  throw new Error(
    `This worktree's database is ${prefix}dev, but DATABASE_URL or DATABASE_URL_UNPOOLED names the local database ${name}, which isn't this worktree's. Unset DATABASE_URL and DATABASE_URL_UNPOOLED in your shell, or run pnpm worktree:setup if the worktree has no database yet.`,
  );
}

export function isLocalDevelopmentDatabase(connectionString: string): boolean {
  return DEVELOPMENT_DATABASE_NAME.test(localDatabaseName(connectionString) ?? "");
}
