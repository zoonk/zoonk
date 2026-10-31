import { getSession } from "@zoonk/core/users/session";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { openWrittenLessonAction } from "./study-session-actions";

// Request identity and Next's after-response scheduling are platform boundaries.
vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));

function countOwedPreparations(sessionId: string) {
  return prisma.followUp.count({ where: { key: sessionId, kind: "prepareSession" } });
}

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
  it("opens a written lesson and starts its block", async () => {
    const { block, input, lesson, session } = await waitingLesson("completed");

    await expect(openWrittenLessonAction(input)).resolves.toStrictEqual({
      kind: "lesson",
      lessonId: lesson.id,
      sessionId: session.id,
    });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "active" });
  });

  it("cannot generate or start an unwritten lesson from a read-driven opening", async () => {
    const { block, input, session } = await waitingLesson("pending");
    await expect(openWrittenLessonAction(input)).resolves.toBeNull();

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "pending" });

    await expect(countOwedPreparations(session.id)).resolves.toBe(0);
  });

  it("cannot open another learner's block", async () => {
    const { block, input, session } = await waitingLesson("completed");
    const stranger = await userFixture();
    vi.mocked(getSession).mockResolvedValue({ user: { id: stranger.id } } as never);
    await expect(openWrittenLessonAction(input)).resolves.toBeNull();

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "pending" });

    await expect(countOwedPreparations(session.id)).resolves.toBe(0);
  });

  it("leaves the ready Start action available when request identity cannot be read", async () => {
    const { input, session } = await waitingLesson("completed");
    vi.mocked(getSession).mockRejectedValueOnce(new Error("Session unavailable"));
    await expect(openWrittenLessonAction(input)).resolves.toBeNull();
    await expect(countOwedPreparations(session.id)).resolves.toBe(0);
  });
});
