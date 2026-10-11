import { captureException, flush } from "@sentry/nextjs";
import { logError } from "@zoonk/utils/logger";
import { type RunFailedHookParams, registerLifecycleHooks } from "workflow/api";
import { parseWorkflowName } from "workflow/observability";

const SENTRY_FLUSH_TIMEOUT_MS = 2000;

declare global {
  /**
   * Unregisters this process's failed-run reports. On `globalThis`, like the runtime's own list
   * of hooks, so a reloaded module replaces its registration instead of adding a second one.
   */
  var zoonkFailedRunReports: (() => void) | undefined;
}

/**
 * Sends a run that failed for good to Sentry and the logs: the runtime calls it once the run's
 * steps used up their retries, or when the run fails outside them (a replay that timed out, a
 * queue that gave up), so no workflow needs a catch of its own to be seen failing. Next's
 * `onRequestError` never sees these: a run fails in the runtime's own invocations, not a request.
 */
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

/**
 * Reports every run that fails (`reportFailedRun`) from the app's startup, once per process: a
 * second registration (a reloaded module) replaces the first instead of reporting twice.
 */
export function registerFailedRunReports(): void {
  globalThis.zoonkFailedRunReports?.();
  globalThis.zoonkFailedRunReports = registerLifecycleHooks({ onRunFailed: reportFailedRun });
}
