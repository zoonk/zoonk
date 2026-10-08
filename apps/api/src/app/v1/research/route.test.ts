import { researchWorkflow } from "@/workflows/v2/research/research-workflow";
import { answerGoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRun, start } from "workflow/api";
import { mockLastRunEvent } from "../../../../mocks/workflow-runtime";
import { POST as createResearch } from "./route";

// Core's integration tests cover who may research which goal and when an upload answers an ask;
// this adapter test covers when a request starts a run and when it follows the goal's last one.
vi.mock("@zoonk/core/library/sources/upload-request", () => ({ answerGoalUploadRequest: vi.fn() }));

vi.mock("workflow/api", () => ({ getRun: vi.fn(), start: vi.fn() }));
vi.mock("@/workflows/v2/research/research-workflow", () => ({ researchWorkflow: vi.fn() }));

const GOAL_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190b";
const SOURCE_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190c";

function researchRequest(body: unknown) {
  return new NextRequest("http://localhost/v1/research", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

function lastRun({ exists = true, status }: { exists?: boolean; status: string }) {
  vi.mocked(getRun).mockReturnValue({
    exists: Promise.resolve(exists),
    status: Promise.resolve(status),
  } as unknown as ReturnType<typeof getRun>);
}

function goalWithRun(researchRunId: string | null, sourceIds: string[] = []) {
  vi.mocked(answerGoalUploadRequest).mockResolvedValue({
    goalId: GOAL_ID,
    researchRunId,
    sourceIds,
    status: "ready",
  });
}

describe("POST /v1/research", () => {
  beforeEach(() => {
    vi.mocked(start).mockResolvedValue({
      runId: "wrun_new",
      status: Promise.resolve("pending"),
    } as unknown as Awaited<ReturnType<typeof start>>);
  });

  it.each(["running", "completed"])(
    "follows the goal's %s research run instead of paying for another",
    async (status) => {
      goalWithRun("wrun_first");
      lastRun({ status });

      const response = await createResearch(researchRequest({ goalId: GOAL_ID }));

      expect(response.status).toBe(202);
      expect(response.headers.get("Location")).toBe("/v1/research/wrun_first");

      await expect(response.json()).resolves.toStrictEqual({
        id: "wrun_first",
        result: null,
        status,
      });

      expect(start).not.toHaveBeenCalled();
    },
  );

  it("starts again only after a failed run, or when the goal has none", async () => {
    goalWithRun("wrun_first");
    lastRun({ status: "failed" });

    const retried = await createResearch(researchRequest({ goalId: GOAL_ID }));

    goalWithRun(null);
    const first = await createResearch(researchRequest({ goalId: GOAL_ID }));

    expect([retried.status, first.status]).toStrictEqual([202, 202]);
    expect(start).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledWith(researchWorkflow, [{ goalId: GOAL_ID, sourceIds: [] }]);
  });

  it("starts again when the goal's run says it's running but stalled, as a restart leaves it", async () => {
    goalWithRun("wrun_first");
    lastRun({ status: "running" });

    // It started a step an hour ago and never recorded anything since.
    mockLastRunEvent("wrun_first", {
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      eventType: "step_started",
    });

    const response = await createResearch(researchRequest({ goalId: GOAL_ID }));

    expect(response.headers.get("Location")).toBe("/v1/research/wrun_new");

    expect(start).toHaveBeenCalledExactlyOnceWith(researchWorkflow, [
      { goalId: GOAL_ID, sourceIds: [] },
    ]);
  });

  it("follows a run that's asleep until its next check, however long ago it went to sleep", async () => {
    goalWithRun("wrun_first");
    lastRun({ status: "running" });

    mockLastRunEvent("wrun_first", {
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      eventData: { resumeAt: new Date(Date.now() + 60 * 1000) },
      eventType: "wait_created",
    });

    const response = await createResearch(researchRequest({ goalId: GOAL_ID }));

    expect(response.headers.get("Location")).toBe("/v1/research/wrun_first");
    expect(start).not.toHaveBeenCalled();
  });

  it("reads the uploads that answer the goal's ask in a new run", async () => {
    goalWithRun("wrun_first", [SOURCE_ID]);
    lastRun({ status: "running" });

    const response = await createResearch(
      researchRequest({ goalId: GOAL_ID, sourceIds: [SOURCE_ID] }),
    );

    expect(response.status).toBe(202);

    expect(start).toHaveBeenCalledExactlyOnceWith(researchWorkflow, [
      { goalId: GOAL_ID, sourceIds: [SOURCE_ID] },
    ]);
  });

  it("refuses uploads when there's no ask to answer", async () => {
    vi.mocked(answerGoalUploadRequest).mockResolvedValue({ status: "noUploadRequest" });

    const response = await createResearch(
      researchRequest({ goalId: GOAL_ID, sourceIds: [SOURCE_ID] }),
    );

    expect(response.status).toBe(409);
    expect(start).not.toHaveBeenCalled();
  });
});
