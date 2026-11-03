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

const LOCAL_DATABASE_NAMES = { dev: "zoonk", e2e: "zoonk_e2e", test: "zoonk_test" } as const;

/** `scripts/cloud/setup.sh` gives Debian's `postgres` role this password. */
export function getLocalDatabaseUrl(mode: keyof typeof LOCAL_DATABASE_NAMES = "dev"): string {
  return `postgres://postgres:postgres@localhost:5432/${LOCAL_DATABASE_NAMES[mode]}`;
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
