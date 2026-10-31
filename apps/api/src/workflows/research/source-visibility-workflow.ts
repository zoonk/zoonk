import { getWorkflowMetadata } from "workflow";
import { classifyUploadStep } from "./steps/classify-upload-step";
import { confirmPublicDocumentStep, shareUploadStep } from "./steps/share-upload-step";

export type SourceVisibilityResult =
  | { status: "missing" | "private" }
  | { merged: boolean; sourceId: string; status: "shared" };

/**
 * An upload stays private to its owner unless the classifier and a search for its title on the
 * publisher's site both say it's public, as the privacy policy promises.
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

  const confirmation = await confirmPublicDocumentStep({ analytics, decision });

  if (!confirmation) {
    return { status: "private" };
  }

  const shared = await shareUploadStep({
    decision,
    sourceId: input.sourceId,
    url: confirmation.url,
  });

  return shared ? { ...shared, status: "shared" } : { status: "private" };
}
