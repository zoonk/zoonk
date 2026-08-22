import "dotenv/config";

const DESTINATION_DATABASE_NAMES = new Set(["zoonk"]);
const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getDatabaseName(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\//u, ""));
}

function assertLocalDestination(connectionString: string): void {
  const url = new URL(connectionString);
  const databaseName = getDatabaseName(url);

  if (!LOCAL_DATABASE_HOSTS.has(url.hostname) || !DESTINATION_DATABASE_NAMES.has(databaseName)) {
    throw new Error("Content sync can only replace the local zoonk database");
  }
}

function assertDifferentDatabases({
  destinationConnectionString,
  sourceConnectionString,
}: {
  destinationConnectionString: string;
  sourceConnectionString: string;
}): void {
  if (destinationConnectionString === sourceConnectionString) {
    throw new Error("Content source and destination databases must be different");
  }
}

export function getContentDatabaseUrls(): {
  destinationConnectionString: string;
  sourceConnectionString: string;
} {
  const sourceConnectionString = getRequiredEnvironmentVariable("CONTENT_SOURCE_DATABASE_URL");

  const destinationConnectionString =
    process.env.DATABASE_URL_UNPOOLED ?? getRequiredEnvironmentVariable("DATABASE_URL");

  assertLocalDestination(destinationConnectionString);
  assertDifferentDatabases({ destinationConnectionString, sourceConnectionString });

  return { destinationConnectionString, sourceConnectionString };
}
