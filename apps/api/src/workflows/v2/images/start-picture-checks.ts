import { start } from "workflow/api";
import { type PictureChecksInput, pictureChecksWorkflow } from "./picture-checks-workflow";

export async function startPictureChecks(input: PictureChecksInput): Promise<void> {
  if (input.assetIds.length > 0) {
    await start(pictureChecksWorkflow, [input]);
  }
}
