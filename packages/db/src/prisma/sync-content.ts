import { logError, logInfo } from "@zoonk/utils/logger";
import { Client } from "pg";
import { getContentDatabaseUrls } from "./_sync-content/config";
import { copyContent } from "./_sync-content/copy";
import {
  assertDestinationContentIsolation,
  clearDestinationContent,
} from "./_sync-content/destination";
import {
  assertCompatibleSchemas,
  getContentIds,
  getOrganizationId,
} from "./_sync-content/metadata";
import {
  restoreDestinationReferences,
  snapshotDestinationReferences,
} from "./_sync-content/preserve";

async function rollback(client: Client): Promise<void> {
  await client.query("ROLLBACK");
}

async function synchronizeConnectedClients({
  destination,
  source,
}: {
  destination: Client;
  source: Client;
}): Promise<void> {
  try {
    await Promise.all([
      source.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"),
      destination.query("BEGIN"),
    ]);

    await assertCompatibleSchemas({ destination, source });

    const [sourceOrganizationId, destinationOrganizationId] = await Promise.all([
      getOrganizationId({ client: source, slug: "ai" }),
      getOrganizationId({ client: destination, slug: "ai" }),
    ]);

    const ids = await getContentIds({ organizationId: sourceOrganizationId, source });

    if (ids.courseIds.length === 0) {
      throw new Error("The source AI organization has no catalog courses");
    }

    await assertDestinationContentIsolation({
      destination,
      organizationId: destinationOrganizationId,
    });

    const references = await snapshotDestinationReferences({
      destination,
      organizationId: destinationOrganizationId,
    });

    await clearDestinationContent({ destination, organizationId: destinationOrganizationId });

    await copyContent({
      destination,
      destinationOrganizationId,
      ids,
      source,
      sourceOrganizationId,
    });

    await restoreDestinationReferences({
      destination,
      expected: references,
      organizationId: destinationOrganizationId,
    });

    await source.query("COMMIT");
    await destination.query("COMMIT");
  } catch (error) {
    await Promise.allSettled([rollback(source), rollback(destination)]);
    throw error;
  }
}

async function synchronizeContent(): Promise<void> {
  const { destinationConnectionString, sourceConnectionString } = getContentDatabaseUrls();
  const source = new Client({ connectionString: sourceConnectionString });
  const destination = new Client({ connectionString: destinationConnectionString });

  try {
    await Promise.all([source.connect(), destination.connect()]);
    await synchronizeConnectedClients({ destination, source });
    logInfo("Local zoonk curriculum content is synchronized");
  } finally {
    await Promise.allSettled([source.end(), destination.end()]);
  }
}

try {
  await synchronizeContent();
} catch (error) {
  logError(error);
  process.exitCode = 1;
}
