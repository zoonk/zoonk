import { captureException, flush } from "@sentry/nextjs";
import { logError } from "@zoonk/utils/logger";
import { type RunFailedHookParams, registerLifecycleHooks } from "workflow/api";
import { parseWorkflowName } from "workflow/observability";

const SENTRY_FLUSH_TIMEOUT_MS = 2000;

declare global {
  /** On `globalThis` so a reloaded module replaces its registration instead of adding a second one. */
  var zoonkFailedRunReports: (() => void) | undefined;
}

/** Next's `onRequestError` never sees a failed run: runs fail in the runtime's own invocations. */
async function reportFailedRun({ error, run, workflowName }: RunFailedHookParams): Promise<void> {
  const failure = error.cause ?? error;
  const name = parseWorkflowName(workflowName)?.shortName ?? workflowName;

  logError(
    `[Workflow Run Failed] ${name} (${run.runId}): ${error.errorCode ?? "unknown"}`,
    failure,
  );

  captureException(failure, {
    tags: {
      "workflow.error_code": error.errorCode,
      "workflow.name": name,
      "workflow.run_id": run.runId,
    },
  });

  // The handler runs after the run ended, so the report is sent before the invocation finishes.
  await flush(SENTRY_FLUSH_TIMEOUT_MS);
}

export function registerFailedRunReports(): void {
  globalThis.zoonkFailedRunReports?.();
  globalThis.zoonkFailedRunReports = registerLifecycleHooks({ onRunFailed: reportFailedRun });
}
