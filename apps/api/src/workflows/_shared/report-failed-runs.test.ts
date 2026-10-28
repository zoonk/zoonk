import { captureException, flush } from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type RunFailedHookParams, registerLifecycleHooks } from "workflow/api";
import { registerFailedRunReports } from "./report-failed-runs";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), flush: vi.fn() }));

const WORKFLOW_NAME = "workflow//./src/workflows/v2/research/research-workflow//researchWorkflow";

function failedRun(cause: unknown): RunFailedHookParams {
  const error = Object.assign(new Error("Workflow run failed"), { cause, errorCode: "USER_ERROR" });

  return {
    error: error as RunFailedHookParams["error"],
    run: { runId: "wrun_failed" } as RunFailedHookParams["run"],
    workflowName: WORKFLOW_NAME,
  };
}

function registerReports() {
  registerFailedRunReports();

  const onRunFailed = vi.mocked(registerLifecycleHooks).mock.lastCall?.[0].onRunFailed;

  if (!onRunFailed) {
    throw new Error("Nothing was registered for failed runs.");
  }

  return onRunFailed;
}

describe(registerFailedRunReports, () => {
  beforeEach(() => {
    vi.mocked(flush).mockResolvedValue(true);
  });

  it("sends the error that ended a run to Sentry, with the workflow and run, before the handler returns", async () => {
    const cause = new Error('Step "extractBlueprintStep" failed after 3 retries: Gateway timeout');

    await registerReports()(failedRun(cause));

    expect(captureException).toHaveBeenCalledExactlyOnceWith(cause, {
      tags: {
        "workflow.error_code": "USER_ERROR",
        "workflow.name": "researchWorkflow",
        "workflow.run_id": "wrun_failed",
      },
    });

    expect(flush).toHaveBeenCalledOnce();
  });

  it("reports the run's own failure when nothing was thrown in it, such as a replay that timed out", async () => {
    const params = failedRun(null);

    await registerReports()(params);

    expect(captureException).toHaveBeenCalledExactlyOnceWith(params.error, expect.any(Object));
  });

  it("reports each failed run once, however many times the app registers the reports", () => {
    const unregister = vi.fn();
    vi.mocked(registerLifecycleHooks).mockReturnValue(unregister);

    registerFailedRunReports();
    registerFailedRunReports();

    expect(registerLifecycleHooks).toHaveBeenCalledTimes(2);
    expect(unregister).toHaveBeenCalledOnce();
  });
});
