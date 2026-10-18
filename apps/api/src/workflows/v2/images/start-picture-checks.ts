import { start } from "workflow/api";
import { type PictureChecksInput, pictureChecksWorkflow } from "./picture-checks-workflow";

/**
 * Starts the background check of pictures a step just drew and stored. Called from a step after
 * its questions are stored, so they're asked while their pictures are checked.
 */
export async function startPictureChecks(input: PictureChecksInput): Promise<void> {
  if (input.assetIds.length > 0) {
    await start(pictureChecksWorkflow, [input]);
  }
}
