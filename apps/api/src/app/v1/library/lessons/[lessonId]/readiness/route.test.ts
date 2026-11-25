import { getLessonContentHookToken } from "@/workflows/lessons/lesson-content-result";
import { completeLessonContent } from "@zoonk/core/library/generation/state";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRun, start } from "workflow/api";
import { mockSession } from "../../../../../../../../../packages/core/src/_test-utils/mock-session";
import { getHookByToken } from "../../../../../../../mocks/workflow-api";
import { POST as writeLesson } from "../generations/route";
import { GET as readLesson } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

const OWNER = "wrun_lesson_owner";

function lessonRequest(lessonId: string, method: "GET" | "POST") {
  const path = method === "GET" ? "readiness" : "generations";
  return new Request(`http://localhost/v1/library/lessons/${lessonId}/${path}`, { method });
}

function read(lessonId: string) {
  return readLesson(lessonRequest(lessonId, "GET"), { params: Promise.resolve({ lessonId }) });
}

function write(lessonId: string) {
  return writeLesson(lessonRequest(lessonId, "POST"), { params: Promise.resolve({ lessonId }) });
}

function runningLesson() {
  return libraryLessonFixture({ contentRunId: OWNER, contentStatus: "running" });
}

function observeStatus(status: string) {
  const cancel = vi.fn();

  vi.mocked(getRun).mockReturnValue({
    cancel,
    exists: Promise.resolve(true),
    status: Promise.resolve(status),
  } as unknown as ReturnType<typeof getRun>);

  return cancel;
}

function failLookup() {
  vi.mocked(getRun).mockImplementation(() => {
    throw new Error("Workflow storage unavailable");
  });
}

function row(id: string) {
  return prisma.lesson.findUniqueOrThrow({ where: { id } });
}

async function signInViewer() {
  const viewer = await userFixture();
  mockSession(viewer.id);
}

describe("GET lesson readiness", () => {
  beforeEach(signInViewer);

  it("returns ready without a run lookup even if the old owner cannot be read", async () => {
    const lesson = await libraryLessonFixture({ contentRunId: OWNER, contentStatus: "completed" });
    failLookup();

    const response = await read(lesson.id);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ generationId: null, status: "ready" });
    expect(getRun).not.toHaveBeenCalled();
  });

  it("follows a live row owner without touching the claim", async () => {
    const lesson = await runningLesson();
    const cancel = observeStatus("running");

    const response = await read(lesson.id);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    await expect(response.json()).resolves.toMatchObject({
      generationId: OWNER,
      status: "generating",
    });

    await expect(row(lesson.id)).resolves.toMatchObject({
      contentStatus: "running",
      updatedAt: lesson.updatedAt,
    });

    expect(cancel).not.toHaveBeenCalled();
  });

  it("releases a confirmed-dead claim and returns the failed row without cancelling", async () => {
    const lesson = await runningLesson();
    const cancel = observeStatus("failed");

    const response = await read(lesson.id);
    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      generationId: null,
      setAside: false,
      status: "failed",
    });

    await expect(row(lesson.id)).resolves.toMatchObject({ contentStatus: "failed" });
    expect(cancel).not.toHaveBeenCalled();
  });

  it("returns a service error without changing the claim on unknown liveness", async () => {
    const lesson = await runningLesson();
    failLookup();

    const response = await read(lesson.id);
    expect(response.status).toBe(503);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SERVICE_UNAVAILABLE" },
    });

    await expect(row(lesson.id)).resolves.toMatchObject({
      contentRunId: OWNER,
      contentStatus: "running",
      updatedAt: lesson.updatedAt,
    });
  });

  it.each(["pending", "failed"] as const)(
    "follows the live token holder before it claims a %s lesson",
    async (contentStatus) => {
      const lesson = await libraryLessonFixture({ contentStatus });
      getHookByToken.mockResolvedValueOnce({ runId: OWNER });
      observeStatus("pending");

      const response = await read(lesson.id);
      expect(response.status).toBe(200);

      await expect(response.json()).resolves.toMatchObject({
        generationId: OWNER,
        status: "generating",
      });

      expect(getHookByToken).toHaveBeenCalledWith(getLessonContentHookToken(lesson.id));
    },
  );

  it("puts set-aside ahead of both a row owner and a token holder", async () => {
    const lesson = await libraryLessonFixture({
      contentRunId: OWNER,
      contentStatus: "running",
      setAsideAt: new Date(),
    });

    getHookByToken.mockResolvedValueOnce({ runId: OWNER });
    observeStatus("running");

    const response = await read(lesson.id);
    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      generationId: null,
      setAside: true,
      status: "failed",
    });

    expect(getRun).not.toHaveBeenCalled();
    expect(getHookByToken).not.toHaveBeenCalled();
  });

  it("returns ready when completion wins the guarded release", async () => {
    const lesson = await runningLesson();

    vi.mocked(getRun).mockReturnValueOnce({
      get exists() {
        return completeLessonContent({ lessonId: lesson.id, workflowRunId: OWNER });
      },
      status: Promise.resolve("completed"),
    } as unknown as ReturnType<typeof getRun>);

    const response = await read(lesson.id);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ generationId: null, status: "ready" });
    await expect(row(lesson.id)).resolves.toMatchObject({ contentStatus: "completed" });
  });

  it("checks visibility before observing or releasing a private claim", async () => {
    const owner = await userFixture();

    const lesson = await libraryLessonFixture({
      contentRunId: OWNER,
      contentStatus: "running",
      ownerId: owner.id,
      visibility: "private",
    });

    observeStatus("failed");

    const response = await read(lesson.id);
    expect(response.status).toBe(404);
    expect(getRun).not.toHaveBeenCalled();
    await expect(row(lesson.id)).resolves.toMatchObject({ contentStatus: "running" });
  });
});

describe("POST lesson writing", () => {
  beforeEach(signInViewer);

  it.each(["alive", "unknown", "ended"] as const)(
    "releases the claim only when liveness is ended (%s)",
    async (activity) => {
      const lesson = await runningLesson();

      if (activity === "unknown") {
        failLookup();
      } else {
        observeStatus(activity === "alive" ? "running" : "failed");
      }

      const response = await write(lesson.id);
      const ended = activity === "ended";

      expect(response.status).toBe(202);

      await expect(response.json()).resolves.toMatchObject({
        generationId: ended ? "started-run" : OWNER,
      });

      await expect(row(lesson.id)).resolves.toMatchObject({
        contentStatus: ended ? "failed" : "running",
      });

      expect(start).toHaveBeenCalledTimes(ended ? 1 : 0);
    },
  );
});
