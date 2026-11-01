import { getWorkflowMetadata } from "workflow";
import { classifyUploadStep } from "./steps/classify-upload-step";
import { findPublisherCopiesStep, shareUploadStep } from "./steps/share-upload-step";

export type SourceVisibilityResult =
  | { status: "missing" | "private" }
  | { merged: boolean; sourceId: string; status: "shared" };

/**
 * An upload stays private to its owner unless the classifier says it's public and a copy on the
 * publisher's site reads the same, as the privacy policy promises.
 */
export async function sourceVisibilityWorkflow(input: {
  ownerId: string;
  sourceId: string;
}): Promise<SourceVisibilityResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const analytics = {
    contentScope: "personal" as const,
    distinctId: input.ownerId,
    traceId: workflowRunId,
  };

  const decision = await classifyUploadStep({ analytics, sourceId: input.sourceId });

  if (!decision) {
    return { status: "missing" };
  }

  if (decision.visibility === "private") {
    return { status: "private" };
  }

  const urls = await findPublisherCopiesStep({ analytics, decision });

  for (const url of urls) {
    // A copy that can't be downloaded confirms nothing, so the next one is tried.
    // oxlint-disable-next-line no-await-in-loop -- Copies after the one that reads the same aren't downloaded.
    const shared = await shareUploadStep({ decision, sourceId: input.sourceId, url }).catch(
      () => null,
    );

    if (shared) {
      return { ...shared, status: "shared" };
    }
  }

  return { status: "private" };
}
