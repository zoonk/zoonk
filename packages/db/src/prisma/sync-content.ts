import { logError, logInfo } from "@zoonk/utils/logger";
import { Client } from "pg";
import { getContentDatabaseUrls } from "./_sync-content/config";
import { copyCatalog } from "./_sync-content/copy";
import {
  assertNoUnkeptReferences,
  clearDestinationContent,
  markRemovedContent,
} from "./_sync-content/destination";
import { readKeptKeys, withoutKeptKeys } from "./_sync-content/kept-keys";
import { assertCompatibleSchemas, getOrganizationId } from "./_sync-content/metadata";
import { restoreLearnerReferences, snapshotLearnerReferences } from "./_sync-content/preserve";
import { readSourceCatalog } from "./_sync-content/source";
import { upsertOrganizations } from "./_sync-content/upserts";

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

    const sourceCatalog = await readSourceCatalog({ organizationId: sourceOrganizationId, source });

    if (sourceCatalog.courses.rows.length === 0) {
      throw new Error("The source has no catalog courses");
    }

    const localCatalog = await upsertOrganizations({
      catalog: sourceCatalog,
      destination,
      organizationId: destinationOrganizationId,
      sourceOrganizationId,
    });

    await markRemovedContent({ courses: localCatalog.courses, destination });

    const catalog = withoutKeptKeys({
      catalog: localCatalog,
      keys: await readKeptKeys({ destination }),
    });

    await assertNoUnkeptReferences(destination);

    const references = await snapshotLearnerReferences(destination);

    await clearDestinationContent({ destination });

    await copyCatalog({ catalog, destination, organizationId: destinationOrganizationId });

    await restoreLearnerReferences({ destination, expected: references });

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
