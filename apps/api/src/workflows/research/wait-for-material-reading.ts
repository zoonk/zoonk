import {
  type MaterialReadingScope,
  findOwedMaterialSourceIds,
} from "@zoonk/core/library/sources/material-reading-scope";
import { waitForRun } from "../_shared/run-token";
import { startUploadReading } from "./read-upload-workflow";

async function findOwedMaterialStep(scope: MaterialReadingScope) {
  "use step";

  return findOwedMaterialSourceIds(scope);
}

/* oxlint-disable no-await-in-loop -- Read the new state after each joined run has settled. */
export async function waitForMaterialReading(scope: MaterialReadingScope): Promise<void> {
  for (;;) {
    const sourceIds = await findOwedMaterialStep(scope);

    if (sourceIds.length === 0) {
      return;
    }

    await Promise.all(
      sourceIds.map(async (sourceId) => waitForRun(await startUploadReading(sourceId))),
    );
  }
}
/* oxlint-enable no-await-in-loop */
