const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

/** The development database, or a linked worktree's; the test and E2E databases never match. */
const DEVELOPMENT_DATABASE_NAME = /^zoonk(?:_wt_[a-f0-9]{12}_dev)?$/u;

/**
 * Whether a connection string points at a local development database, the only one tools that
 * replace or delete data may change: never a remote database, a test or an E2E one.
 */
export function isLocalDevelopmentDatabase(connectionString: string): boolean {
  if (!URL.canParse(connectionString)) {
    return false;
  }

  const url = new URL(connectionString);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//u, ""));

  return LOCAL_DATABASE_HOSTS.has(url.hostname) && DEVELOPMENT_DATABASE_NAME.test(databaseName);
}
