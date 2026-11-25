import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { getWorld } from "workflow/runtime";
import { mockLastRunEvent, resetWorkflowRuntimeMock } from "../../../mocks/workflow-runtime";
import { isRunActive, observeRunActivity, readClientRunStatus } from "./run-activity";

const MINUTE_MS = 60 * 1000;

function fakeRun(status: string) {
  vi.mocked(getRun).mockReturnValue({
    exists: Promise.resolve(true),
    status: Promise.resolve(status),
  } as unknown as ReturnType<typeof getRun>);
}

function serverStartedAgo(ms: number) {
  vi.spyOn(process, "uptime").mockReturnValue(ms / 1000);
}

describe("run activity", () => {
  beforeEach(() => {
    fakeRun("running");

    mockLastRunEvent("run-1", {
      createdAt: new Date(Date.now() - 5 * MINUTE_MS),
      eventType: "step_started",
    });
  });

  afterEach(() => {
    resetWorkflowRuntimeMock();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(["pending", "running"])(
    "observes a %s run with recent progress as alive",
    async (status) => {
      fakeRun(status);
      await expect(observeRunActivity("run-1")).resolves.toBe("alive");
    },
  );

  it.each(["completed", "failed", "cancelled"])("observes a %s run as ended", async (status) => {
    fakeRun(status);
    await expect(observeRunActivity("run-1")).resolves.toBe("ended");
  });

  it("observes a confirmed missing run as ended", async () => {
    vi.mocked(getRun).mockReset();
    await expect(observeRunActivity("run-1")).resolves.toBe("ended");
  });

  it("observes a lookup error as unknown", async () => {
    vi.mocked(getRun).mockImplementationOnce(() => {
      throw new Error("Workflow storage unavailable");
    });

    await expect(observeRunActivity("run-1")).resolves.toBe("unknown");
  });

  it("observes a run as unknown when its events cannot be read", async () => {
    vi.mocked(getWorld).mockRejectedValueOnce(new Error("Workflow events unavailable"));
    await expect(observeRunActivity("run-1")).resolves.toBe("unknown");
  });

  it("observes a run quiet for more than 30 minutes as ended", async () => {
    mockLastRunEvent("run-1", {
      createdAt: new Date(Date.now() - 31 * MINUTE_MS),
      eventType: "step_started",
    });

    await expect(observeRunActivity("run-1")).resolves.toBe("ended");
  });

  it("allows the scheduled resume time before counting quiet time", async () => {
    mockLastRunEvent("run-1", {
      createdAt: new Date(Date.now() - 31 * MINUTE_MS),
      eventData: { resumeAt: new Date(Date.now() + MINUTE_MS) },
      eventType: "wait_created",
    });

    await expect(observeRunActivity("run-1")).resolves.toBe("alive");
  });

  it("sees a dev server's run from before its restart as stalled, so it starts again", async () => {
    vi.stubEnv("NODE_ENV", "development");
    serverStartedAgo(MINUTE_MS);

    await expect(isRunActive("run-1")).resolves.toBe(false);
    await expect(readClientRunStatus("run-1")).resolves.toBe("failed");
  });

  it("keeps following a dev server's run that recorded something since it started", async () => {
    vi.stubEnv("NODE_ENV", "development");
    serverStartedAgo(10 * MINUTE_MS);

    await expect(isRunActive("run-1")).resolves.toBe(true);
  });

  it("waits the whole stall time outside a dev server", async () => {
    vi.stubEnv("NODE_ENV", "production");
    serverStartedAgo(MINUTE_MS);

    await expect(isRunActive("run-1")).resolves.toBe(true);
    await expect(readClientRunStatus("run-1")).resolves.toBe("running");
  });
});
