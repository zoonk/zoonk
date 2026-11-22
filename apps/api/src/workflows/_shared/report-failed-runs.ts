import { captureException, flush } from "@sentry/nextjs";
import { logError } from "@zoonk/utils/logger";
import { type RunFailedHookParams, registerLifecycleHooks } from "workflow/api";
import { parseWorkflowName } from "workflow/observability";

const SENTRY_FLUSH_TIMEOUT_MS = 2000;

declare global {
  /** On `globalThis` so a reloaded module replaces its registration instead of adding a second one. */
  var zoonkFailedRunReports: (() => void) | undefined;
}

export async function reportWorkflowFailure({
  error,
  errorCode,
  message,
  runId,
  workflowName,
}: {
  error: unknown;
  errorCode?: string;
  message: string;
  runId: string;
  workflowName: string;
}): Promise<void> {
  logError(message, error);

  captureException(error, {
    tags: {
      ...(errorCode && { "workflow.error_code": errorCode }),
      "workflow.name": workflowName,
      "workflow.run_id": runId,
    },
  });

  await flush(SENTRY_FLUSH_TIMEOUT_MS);
}

/** Next's `onRequestError` never sees a failed run: runs fail in the runtime's own invocations. */
async function reportFailedRun({ error, run, workflowName }: RunFailedHookParams): Promise<void> {
  const name = parseWorkflowName(workflowName)?.shortName ?? workflowName;

  await reportWorkflowFailure({
    error: error.cause ?? error,
    errorCode: error.errorCode,
    message: `[Workflow Run Failed] ${name} (${run.runId}): ${error.errorCode ?? "unknown"}`,
    runId: run.runId,
    workflowName: name,
  });
}

export function registerFailedRunReports(): void {
  globalThis.zoonkFailedRunReports?.();
  globalThis.zoonkFailedRunReports = registerLifecycleHooks({ onRunFailed: reportFailedRun });
}
