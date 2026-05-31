import { captureException, flush } from "@sentry/nextjs";
import { logError } from "@zoonk/utils/logger";
import { type WorkflowErrorLog } from "./workflow-error";

type WorkflowFailureEntity = "chapter" | "course" | "lesson";

type WorkflowFailureInput = {
  entity: WorkflowFailureEntity;
  entityId: string;
  error?: WorkflowErrorLog;
  workflowName: string;
};

const sentryFlushTimeoutMs = 2000;

/**
 * Gives Sentry a real Error instance even though Workflow failure handlers pass
 * serialized error data across step boundaries.
 */
function buildWorkflowFailureError(error?: WorkflowErrorLog): Error {
  const failure = new Error(error?.message ?? "Workflow failed without a serialized error");
  failure.name = error?.name ?? "WorkflowError";

  if (error?.stack) {
    failure.stack = error.stack;
  }

  return failure;
}

/**
 * Reports background Workflow failures explicitly because Next's
 * `onRequestError` hook only observes request handling errors, not final
 * durable-step failures recorded by Workflow itself.
 */
export async function captureWorkflowFailure({
  entity,
  entityId,
  error,
  workflowName,
}: WorkflowFailureInput): Promise<void> {
  try {
    captureException(buildWorkflowFailureError(error), {
      contexts: {
        workflow: { entity, entityId, name: workflowName, serializedError: error ?? null },
      },
      tags: {
        "workflow.entity": entity,
        "workflow.entity_id": entityId,
        "workflow.name": workflowName,
      },
    });

    await flush(sentryFlushTimeoutMs);
  } catch (captureError) {
    // Sentry is best-effort here. Rethrowing would hide the original workflow
    // failure and could prevent the failure handler from updating local state.
    logError("[Workflow Sentry Capture Failure]", captureError);
  }
}
