import { describe, expect, it, vi } from "vitest";
import { getRun, resumeHook } from "workflow/api";
import { HookConflictError, HookNotFoundError } from "workflow/errors";
import { mockLastRunEvent } from "../../../mocks/workflow-runtime";
import { getStartMock } from "../_test-utils/start-mock";
import { researchWorkflow } from "./research-workflow";
import { startOrResumeResearch } from "./start-or-resume-research";

const GOAL_ID = "goal-1";
const TOKEN = `research-goal:${GOAL_ID}`;
const COUNTRY_TOKEN = `research-country:${GOAL_ID}`;

function holdingRun({ createdAt, statuses }: { createdAt: Date; statuses: string[] }) {
  const status = vi.fn<() => Promise<string | undefined>>();
  statuses.forEach((value) => status.mockResolvedValueOnce(value));
  status.mockResolvedValue(statuses.at(-1));

  vi.mocked(getRun).mockImplementation(
    () =>
      ({
        createdAt: Promise.resolve(createdAt),
        exists: Promise.resolve(true),
        get status() {
          return status();
        },
      }) as unknown as ReturnType<typeof getRun>,
  );

  mockLastRunEvent("holder", { createdAt: new Date(), eventType: "hook_created" });
}

function olderHolder(statuses: string[]) {
  holdingRun({ createdAt: new Date(Date.now() - 60_000), statuses });
  getStartMock().mockRejectedValueOnce(new HookConflictError(TOKEN, "holder"));
}

describe(startOrResumeResearch, () => {
  it("leaves the answer to the run it just started", async () => {
    holdingRun({ createdAt: new Date(Date.now() + 1000), statuses: ["running"] });
    getStartMock().mockResolvedValueOnce({ runId: "new-run" } as never);

    await startOrResumeResearch(GOAL_ID);

    expect(getStartMock()).toHaveBeenCalledOnce();
    expect(resumeHook).not.toHaveBeenCalled();
  });

  it("wakes the run waiting for the exam's country instead of starting another", async () => {
    olderHolder(["running"]);
    vi.mocked(resumeHook).mockResolvedValueOnce({ runId: "holder" } as never);

    await startOrResumeResearch(GOAL_ID);

    expect(getStartMock()).toHaveBeenCalledOnce();
    expect(resumeHook).toHaveBeenCalledExactlyOnceWith(COUNTRY_TOKEN, {});
  });

  it("starts the research again once a run that read the goal before the answer ends", async () => {
    olderHolder(["running", "running", "completed"]);

    vi.mocked(resumeHook).mockImplementation(async (token) => {
      if (token === COUNTRY_TOKEN) {
        throw new HookNotFoundError(COUNTRY_TOKEN);
      }

      return { runId: "holder" } as never;
    });

    getStartMock().mockResolvedValueOnce({ runId: "new-run" } as never);

    await startOrResumeResearch(GOAL_ID);

    expect(getStartMock()).toHaveBeenCalledTimes(2);

    expect(getStartMock()).toHaveBeenLastCalledWith(researchWorkflow, [{ goalId: GOAL_ID }], {
      experimental_hook: { token: TOKEN },
    });
  });
});
