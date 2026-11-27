import { realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type DatabaseMode,
  LOCAL_DATABASE_NAMES,
  worktreeDatabaseName,
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

export function isLinkedWorktree(checkout: string): boolean {
  return statSync(join(checkout, ".git"), { throwIfNoEntry: false })?.isFile() ?? false;
}

/** `scripts/cloud/setup.sh` gives Debian's `postgres` role this password. */
export function getLocalDatabaseUrl(
  mode: DatabaseMode = "dev",
  // Turbopack leaves out import.meta.dirname in the bundled server.
  checkout = findCheckout(import.meta.dirname ?? process.cwd()),
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

export function isLocalDevelopmentDatabase(connectionString: string): boolean {
  if (!URL.canParse(connectionString)) {
    return false;
  }

  const url = new URL(connectionString);

  if (
    !POSTGRES_PROTOCOLS.has(url.protocol) ||
    [...url.searchParams.keys()].some((key) => CONNECTION_TARGET_PARAMETERS.has(key.toLowerCase()))
  ) {
    return false;
  }

  try {
    const databaseName = decodeURIComponent(url.pathname.replace(/^\//u, ""));

    return LOCAL_DATABASE_HOSTS.has(url.hostname) && DEVELOPMENT_DATABASE_NAME.test(databaseName);
  } catch {
    return false;
  }
}
