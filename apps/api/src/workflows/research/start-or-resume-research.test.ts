import { describe, expect, it, vi } from "vitest";
import { getRun, resumeHook } from "workflow/api";
import { HookConflictError, HookNotFoundError } from "workflow/errors";
import { mockLastRunEvent } from "../../../mocks/workflow-runtime";
import { getStartMock } from "../_test-utils/start-mock";
import { researchWorkflow } from "./research-workflow";
import { startOrResumeResearch } from "./start-or-resume-research";

const GOAL_ID = "goal-1";
const TOKEN = `research-goal:${GOAL_ID}`;

function waitingRun() {
  vi.mocked(getRun).mockReturnValue({
    exists: Promise.resolve(true),
    status: Promise.resolve("running"),
  } as unknown as ReturnType<typeof getRun>);

  mockLastRunEvent("waiting", { createdAt: new Date(), eventType: "hook_created" });
  getStartMock().mockRejectedValueOnce(new HookConflictError(TOKEN, "waiting"));
}

describe(startOrResumeResearch, () => {
  it("wakes the run waiting for the answer instead of starting another", async () => {
    waitingRun();
    vi.mocked(resumeHook).mockResolvedValueOnce({ runId: "waiting" } as never);

    await startOrResumeResearch(GOAL_ID);

    expect(getStartMock()).toHaveBeenCalledOnce();
    expect(resumeHook).toHaveBeenCalledExactlyOnceWith(TOKEN, {});
  });

  it("starts the research again once the run that held its token has ended", async () => {
    waitingRun();
    vi.mocked(resumeHook).mockRejectedValueOnce(new HookNotFoundError(TOKEN));
    getStartMock().mockResolvedValueOnce({ runId: "new-run" } as never);

    await startOrResumeResearch(GOAL_ID);

    expect(getStartMock()).toHaveBeenLastCalledWith(researchWorkflow, [{ goalId: GOAL_ID }], {
      experimental_hook: { token: TOKEN },
    });

    expect(getStartMock()).toHaveBeenCalledTimes(2);
  });
});
