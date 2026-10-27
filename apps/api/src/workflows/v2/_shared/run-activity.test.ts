import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { mockLastRunEvent, resetWorkflowRuntimeMock } from "../../../../mocks/workflow-runtime";
import { isRunActive, readClientRunStatus } from "./run-activity";

const MINUTE_MS = 60 * 1000;

function runningRun() {
  vi.mocked(getRun).mockReturnValue({
    exists: Promise.resolve(true),
    status: Promise.resolve("running"),
  } as unknown as ReturnType<typeof getRun>);
}

/** The server process started this long ago. */
function serverStartedAgo(ms: number) {
  vi.spyOn(process, "uptime").mockReturnValue(ms / 1000);
}

describe("run activity", () => {
  beforeEach(() => {
    runningRun();

    // A step started five minutes ago and nothing since: still working, unless the server died.
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
