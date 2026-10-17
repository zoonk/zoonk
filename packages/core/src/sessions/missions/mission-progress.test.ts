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

describe("progress of saved plan-anchored missions", () => {
  it.each([
    ["review", "review"],
    ["somethingNew", "learn"],
    ["practice", "practice"],
    ["essay", "produce"],
    ["challenge", "checkpoint"],
    ["weeklyChallenge", "checkpoint"],
    ["mock", "checkpoint"],
  ] as const)("counts %s only when its offered block is finished", async (kind, blockKind) => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const planItemId = crypto.randomUUID();

    const session = await studySessionFixture({
      goalId: goal.id,
      missions: { picks: [{ anchor: { blockKind, planItemId }, kind, total: 1 }], version: 1 },
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      kind: blockKind,
      payload: toBlockPayload({ planItemId }),
      sessionId: session.id,
    });

    const read = async () =>
      getDayMissions({
        session: await prisma.studySession.findUniqueOrThrow({
          include: STUDY_SESSION_INCLUDE,
          where: { id: session.id },
        }),
        timeZone: "UTC",
      });

    await expect(read()).resolves.toMatchObject([
      { done: 0, kind, opens: { blockId: block.id, kind: "block" }, status: "todo", total: 1 },
    ]);

    await prisma.studySessionBlock.update({ data: { status: "active" }, where: { id: block.id } });
    await expect(read()).resolves.toMatchObject([{ done: 0, kind, status: "todo", total: 1 }]);

    await prisma.studySessionBlock.update({
      data: { completedAt: new Date(), status: "completed" },
      where: { id: block.id },
    });

    await expect(read()).resolves.toMatchObject([{ done: 1, kind, status: "done", total: 1 }]);
  });

  it("finishes a chapter only after every captured remaining lesson is done", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const lessons = await Promise.all([libraryLessonFixture(), libraryLessonFixture()]);

    const session = await studySessionFixture({
      goalId: goal.id,
      missions: {
        picks: [
          {
            anchor: { lessonIds: lessons.map((lesson) => lesson.id) },
            kind: "finishChapter",
            total: 2,
          },
        ],
        version: 1,
      },
      userId: user.id,
    });

    const blocks = await Promise.all(
      lessons.map((lesson, position) =>
        studySessionBlockFixture({
          kind: "learn",
          lessonId: lesson.id,
          position,
          sessionId: session.id,
        }),
      ),
    );

    const read = async () =>
      getDayMissions({
        session: await prisma.studySession.findUniqueOrThrow({
          include: STUDY_SESSION_INCLUDE,
          where: { id: session.id },
        }),
        timeZone: "UTC",
      });

    await prisma.studySessionBlock.update({
      data: { status: "completed" },
      where: { id: blocks[0]?.id },
    });

    await expect(read()).resolves.toMatchObject([
      {
        done: 1,
        kind: "finishChapter",
        opens: { blockId: blocks[1]?.id, kind: "block" },
        status: "todo",
        total: 2,
      },
    ]);

    await prisma.studySessionBlock.update({
      data: { status: "completed" },
      where: { id: blocks[1]?.id },
    });

    await expect(read()).resolves.toMatchObject([
      { done: 2, kind: "finishChapter", status: "done", total: 2 },
    ]);
  });

  it("says a phase challenge waits for the day's lessons before it, until they're done", async () => {
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

    const [lesson, challenge] = await Promise.all([
      studySessionBlockFixture({ kind: "learn", position: 0, sessionId: session.id }),
      studySessionBlockFixture({
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
        }),
        position: 1,
        sessionId: session.id,
      }),
    ]);

    const read = async () =>
      getDayMissions({
        session: await prisma.studySession.findUniqueOrThrow({
          include: STUDY_SESSION_INCLUDE,
          where: { id: session.id },
        }),
        timeZone: "UTC",
      });

    await expect(read()).resolves.toStrictEqual([
      {
        done: 0,
        kind: "challenge",
        opens: { blockId: challenge.id, kind: "block" },
        status: "todo",
        total: 1,
        waitReason: "lessons",
      },
    ]);

    await prisma.studySessionBlock.update({
      data: { completedAt: new Date(), status: "completed" },
      where: { id: lesson.id },
    });

    await expect(read()).resolves.toStrictEqual([
      {
        done: 0,
        kind: "challenge",
        opens: { blockId: challenge.id, kind: "block" },
        status: "todo",
        total: 1,
      },
    ]);
  });
});
