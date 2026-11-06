import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { HookConflictError, WorkflowStartError } from "workflow/errors";
import { mockLastRunEvent } from "../../../mocks/workflow-runtime";
import { getStartMock } from "../_test-utils/start-mock";
import { startOnce } from "./run-token";

const TOKEN = "lesson-content:lesson-1";
const HOUR_MS = 60 * 60 * 1000;

async function writeLesson(_lessonId: string): Promise<void> {}

const cancel = vi.fn();

function holderRun({ readable = true }: { readable?: boolean } = {}) {
  vi.mocked(getRun).mockReturnValue({
    cancel,
    exists: readable ? Promise.resolve(true) : Promise.reject(new Error("World unavailable")),
    status: Promise.resolve("running"),
  } as unknown as ReturnType<typeof getRun>);
}

function lastHeardFrom(runId: string, ago: number) {
  mockLastRunEvent(runId, { createdAt: new Date(Date.now() - ago), eventType: "step_started" });
}

function conflictWith(runId: string) {
  return Promise.reject(new HookConflictError(TOKEN, runId));
}

describe(startOnce, () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    holderRun();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("starts a run holding the token", async () => {
    getStartMock().mockResolvedValueOnce({ runId: "new-run" } as never);

    await expect(startOnce(writeLesson, ["lesson-1"], TOKEN)).resolves.toBe("new-run");

    expect(getStartMock()).toHaveBeenCalledWith(writeLesson, ["lesson-1"], {
      experimental_hook: { token: TOKEN },
    });
  });

  it("returns the run already holding the token instead of starting another", async () => {
    getStartMock().mockImplementationOnce(() => conflictWith("holder"));
    lastHeardFrom("holder", 60 * 1000);

    await expect(startOnce(writeLesson, ["lesson-1"], TOKEN)).resolves.toBe("holder");

    expect(getStartMock()).toHaveBeenCalledOnce();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("stops a stalled holder and starts in its place", async () => {
    getStartMock()
      .mockImplementationOnce(() => conflictWith("stalled"))
      .mockResolvedValueOnce({ runId: "new-run" } as never);

    lastHeardFrom("stalled", HOUR_MS);

    await expect(startOnce(writeLesson, ["lesson-1"], TOKEN)).resolves.toBe("new-run");

    expect(cancel).toHaveBeenCalledOnce();
    expect(getStartMock()).toHaveBeenCalledTimes(2);
  });

  it("returns the run that took the token after a stalled holder was stopped", async () => {
    getStartMock()
      .mockImplementationOnce(() => conflictWith("stalled"))
      .mockImplementationOnce(() => conflictWith("next-holder"));

    lastHeardFrom("stalled", HOUR_MS);

    await expect(startOnce(writeLesson, ["lesson-1"], TOKEN)).resolves.toBe("next-holder");
    expect(getStartMock()).toHaveBeenCalledTimes(2);
  });

  it("never stops a holder it can't read, such as one admitted but not yet a run", async () => {
    holderRun({ readable: false });
    getStartMock().mockImplementationOnce(() => conflictWith("admitted"));
    lastHeardFrom("admitted", HOUR_MS);

    await expect(startOnce(writeLesson, ["lesson-1"], TOKEN)).resolves.toBe("admitted");
    expect(cancel).not.toHaveBeenCalled();
  });

  it("throws when the start's outcome is unknown, so a retry with the token is safe", async () => {
    const unknown = new WorkflowStartError("candidate", "admission");
    getStartMock().mockRejectedValueOnce(unknown);

    await expect(startOnce(writeLesson, ["lesson-1"], TOKEN)).rejects.toBe(unknown);
  });

  it("throws a conflict that names no holder", async () => {
    const conflict = new HookConflictError(TOKEN);
    getStartMock().mockRejectedValueOnce(conflict);

    await expect(startOnce(writeLesson, ["lesson-1"], TOKEN)).rejects.toBe(conflict);
  });
});
