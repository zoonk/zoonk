import { getSession } from "@zoonk/core/users/session";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { openStudyBlock } from "./open-study-block";

/** Identity and the after-response call that starts follow-ups are platform/external boundaries. */
vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));

function countOwedPreparations(sessionId: string) {
  return prisma.followUp.count({ where: { key: sessionId, kind: "prepareSession" } });
}

describe(openStudyBlock, () => {
  it("leaves a guest's unwritten lesson to the browser without a competing preparation", async () => {
    const [user, lesson] = await Promise.all([
      userFixture(),
      libraryLessonFixture({ contentStatus: "pending" }),
    ]);

    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    const session = await studySessionFixture({ userId: user.id });
    const block = await studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id });
    vi.mocked(getSession).mockResolvedValue({ user: { id: user.id } } as never);

    await expect(
      openStudyBlock({
        block: { ...block, checkpoint: null, planItemId: null },
        sessionId: session.id,
        timeZone: "UTC",
      }),
    ).resolves.toStrictEqual({
      blockId: block.id,
      kind: "unwrittenLesson",
      lessonId: lesson.id,
      sessionId: session.id,
    });

    await expect(countOwedPreparations(session.id)).resolves.toBe(0);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "pending" });
  });

  it("prepares a lesson placeholder that the browser cannot request yet", async () => {
    const user = await userFixture();
    const session = await studySessionFixture({ userId: user.id });
    const block = await studySessionBlockFixture({ lessonId: null, sessionId: session.id });
    vi.mocked(getSession).mockResolvedValue({ user: { id: user.id } } as never);

    await expect(
      openStudyBlock({
        block: { ...block, checkpoint: null, planItemId: null },
        sessionId: session.id,
        timeZone: "UTC",
      }),
    ).resolves.toStrictEqual({ blockId: block.id, kind: "preparingLesson" });

    await expect(countOwedPreparations(session.id)).resolves.toBe(1);
  });

  it("still prepares ahead when the learner opens a written lesson", async () => {
    const [user, lesson] = await Promise.all([
      userFixture(),
      libraryLessonFixture({ contentStatus: "completed" }),
    ]);

    const session = await studySessionFixture({ userId: user.id });
    const block = await studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id });
    vi.mocked(getSession).mockResolvedValue({ user: { id: user.id } } as never);

    await expect(
      openStudyBlock({
        block: { ...block, checkpoint: null, planItemId: null },
        sessionId: session.id,
        timeZone: "UTC",
      }),
    ).resolves.toStrictEqual({ kind: "lesson", lessonId: lesson.id, sessionId: session.id });

    await expect(countOwedPreparations(session.id)).resolves.toBe(1);
  });
});
