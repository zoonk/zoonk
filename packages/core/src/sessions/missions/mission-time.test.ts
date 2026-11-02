import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { STUDY_SESSION_INCLUDE } from "../_utils/study-session-access";
import { toBlockPayload } from "../block-payload";
import { getDayMissions } from "./get-day-missions";

async function readMissions(sessionId: string) {
  return getDayMissions({
    session: await prisma.studySession.findUniqueOrThrow({
      include: STUDY_SESSION_INCLUDE,
      where: { id: sessionId },
    }),
    timeZone: "UTC",
  });
}

describe("what a mission still asks", () => {
  it("names a chapter's next lesson and counts the minutes its unfinished lessons take", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const lessons = await Promise.all([
      libraryLessonFixture({ estimatedMinutes: 5 }),
      libraryLessonFixture({ estimatedMinutes: 6 }),
    ]);

    const session = await studySessionFixture({
      goalId: goal.id,
      missions: {
        picks: [
          {
            anchor: { lessonIds: lessons.map((lesson) => lesson.id) },
            detail: { chapterTitle: "Porcentagem", title: "Porcentagem e descontos" },
            kind: "finishChapter",
            total: 2,
          },
        ],
        version: 1,
      },
      userId: user.id,
    });

    const [first] = await Promise.all([
      studySessionBlockFixture({
        estimatedMinutes: 5,
        lessonId: lessons[0]?.id,
        payload: toBlockPayload({ title: "Porcentagem e descontos" }),
        position: 0,
        sessionId: session.id,
      }),
      studySessionBlockFixture({
        estimatedMinutes: 6,
        lessonId: lessons[1]?.id,
        payload: toBlockPayload({ title: "Juros simples" }),
        position: 1,
        sessionId: session.id,
      }),
    ]);

    await expect(readMissions(session.id)).resolves.toMatchObject([
      { detail: { chapterTitle: "Porcentagem", title: "Porcentagem e descontos" }, minutes: 11 },
    ]);

    await prisma.studySessionBlock.update({
      data: { completedAt: new Date(), status: "completed" },
      where: { id: first?.id },
    });

    await expect(readMissions(session.id)).resolves.toMatchObject([
      { detail: { chapterTitle: "Porcentagem", title: "Juros simples" }, done: 1, minutes: 6 },
    ]);

    await prisma.studySessionBlock.updateMany({
      data: { completedAt: new Date(), status: "completed" },
      where: { sessionId: session.id },
    });

    const [done] = await readMissions(session.id);
    expect(done).toMatchObject({ done: 2, status: "done" });
    expect(done).not.toHaveProperty("minutes");
  });

  it("counts only the lesson a new-lesson mission asks for, not every lesson that could be it", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const session = await studySessionFixture({
      goalId: goal.id,
      missions: {
        picks: [{ anchor: { blockKind: "learn" }, kind: "somethingNew", total: 1 }],
        version: 1,
      },
      userId: user.id,
    });

    await Promise.all(
      [7, 6, 6].map((estimatedMinutes, position) =>
        studySessionBlockFixture({
          estimatedMinutes,
          payload: toBlockPayload({ title: `Lesson ${position + 1}` }),
          position,
          sessionId: session.id,
        }),
      ),
    );

    await expect(readMissions(session.id)).resolves.toMatchObject([
      { detail: { title: "Lesson 1" }, kind: "somethingNew", minutes: 7 },
    ]);
  });

  it("counts a waiting challenge's minutes, since the learner still has it to do today", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const planItemId = crypto.randomUUID();

    const session = await studySessionFixture({
      goalId: goal.id,
      missions: {
        picks: [{ anchor: { blockKind: "checkpoint", planItemId }, kind: "challenge", total: 1 }],
        version: 1,
      },
      userId: user.id,
    });

    await studySessionBlockFixture({ estimatedMinutes: 4, position: 0, sessionId: session.id });

    await studySessionBlockFixture({
      estimatedMinutes: 6,
      kind: "checkpoint",
      payload: toBlockPayload({
        checkpoint: {
          kind: "boss",
          mock: false,
          passMark: 4,
          phase: 0,
          rematch: false,
          timeLimitMinutes: null,
        },
        planItemId,
        title: "O Pegadinha",
      }),
      position: 1,
      sessionId: session.id,
    });

    await expect(readMissions(session.id)).resolves.toMatchObject([
      { kind: "challenge", minutes: 6, waitReason: "lessons" },
    ]);
  });

  it.each([
    ["fixMistake", 3, 6],
    ["askBuddy", 1, 2],
    ["pronunciation", 1, 3],
  ] as const)(
    "estimates %s, which is done outside the day's blocks",
    async (kind, total, minutes) => {
      const user = await userFixture();
      const goal = await goalFixture({ userId: user.id });

      const session = await studySessionFixture({
        goalId: goal.id,
        missions: { picks: [{ anchor: {}, kind, total }], version: 1 },
        userId: user.id,
      });

      await expect(readMissions(session.id)).resolves.toMatchObject([{ kind, minutes }]);
    },
  );
});
