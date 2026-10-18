import { getSession } from "@zoonk/core/users/session";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { prepareStudySession } from "./session-preparation";
import { openWrittenLessonAction } from "./study-session-actions";

// Request identity and Next's after-response scheduling are platform boundaries. Persistence and
// block-start permissions below use the real disposable test database.
vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
// Preparation sends a request to the external API; a read-driven opening must never reach it.
vi.mock("./session-preparation", () => ({ prepareStudySession: vi.fn() }));

async function waitingLesson(contentStatus: "completed" | "pending") {
  const [user, lesson] = await Promise.all([
    userFixture(),
    libraryLessonFixture({ contentStatus }),
  ]);

  const session = await studySessionFixture({ userId: user.id });
  const block = await studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id });
  vi.mocked(getSession).mockResolvedValue({ user: { id: user.id } } as never);

  return {
    block,
    input: { blockId: block.id, sessionId: session.id, timeZone: "UTC" },
    lesson,
    session,
  };
}

describe(openWrittenLessonAction, () => {
  it("opens a written lesson and starts its block without preparing more AI work", async () => {
    const { block, input, lesson, session } = await waitingLesson("completed");

    await expect(openWrittenLessonAction(input)).resolves.toStrictEqual({
      kind: "lesson",
      lessonId: lesson.id,
      sessionId: session.id,
    });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "active" });

    expect(prepareStudySession).not.toHaveBeenCalled();
  });

  it("cannot generate or start an unwritten lesson from a read-driven opening", async () => {
    const { block, input } = await waitingLesson("pending");
    await expect(openWrittenLessonAction(input)).resolves.toBeNull();

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "pending" });

    expect(prepareStudySession).not.toHaveBeenCalled();
  });

  it("cannot open another learner's block", async () => {
    const { block, input } = await waitingLesson("completed");
    const stranger = await userFixture();
    vi.mocked(getSession).mockResolvedValue({ user: { id: stranger.id } } as never);
    await expect(openWrittenLessonAction(input)).resolves.toBeNull();

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "pending" });

    expect(prepareStudySession).not.toHaveBeenCalled();
  });

  it("leaves the ready Start action available when request identity cannot be read", async () => {
    const { input } = await waitingLesson("completed");
    vi.mocked(getSession).mockRejectedValueOnce(new Error("Session unavailable"));
    await expect(openWrittenLessonAction(input)).resolves.toBeNull();
    expect(prepareStudySession).not.toHaveBeenCalled();
  });
});
