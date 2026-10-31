import { config } from "dotenv";
import { isLocalDevelopmentDatabase } from "../../local-database";

config();

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function assertLocalDestination(connectionString: string): void {
  if (!isLocalDevelopmentDatabase(connectionString)) {
    throw new Error("Content sync can only replace a local Zoonk development database");
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
