import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { learnerGoalFixture } from "../../learner/_test-utils/learner-goal";
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

async function goalActivityFixture({
  goalId,
  skillId,
  userId,
}: {
  goalId: string;
  skillId: string | undefined;
  userId: string;
}) {
  const thread = await prisma.lessonQuestionThread.create({
    data: { goalId, kind: "plan", userId },
  });

  await Promise.all([
    prisma.lessonQuestion.create({
      data: {
        contextKind: "lesson",
        contextSnapshot: {},
        goalId,
        question: "Why?",
        requestFingerprint: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        threadId: thread.id,
      },
    }),
    prisma.languageConversation.create({
      data: {
        endedAt: new Date(),
        goalId,
        kind: "practice",
        language: "en",
        level: "A2",
        minutes: 5,
        scenario: {},
        spokenSeconds: 60,
        startedAt: new Date(),
        status: "completed",
        targetLanguage: "es",
        titleSnapshot: "At the market",
        userId,
      },
    }),
    learningEventFixture({ goalId, kind: "review", lessonKind: "pronunciationReview", userId }),
    mistakeFixture({ fixedAt: new Date(), skillId, status: "fixed", userId }),
  ]);
}

describe("progress of missions done outside the day's blocks", () => {
  it("counts only the session's own goal's activity", async () => {
    const user = await userFixture();

    const [mine, other] = await Promise.all([
      learnerGoalFixture({ phases: [1], userId: user.id }),
      learnerGoalFixture({ phases: [1], userId: user.id }),
    ]);

    const missions = {
      picks: [
        { anchor: {}, kind: "askBuddy", total: 1 },
        { anchor: {}, kind: "call", total: 1 },
        { anchor: {}, kind: "pronunciation", total: 1 },
        { anchor: {}, kind: "fixMistake", total: 1 },
      ],
      version: 1,
    };

    const [mineDay, otherDay] = await Promise.all([
      studySessionFixture({ goalId: mine.goal.id, missions, userId: user.id }),
      studySessionFixture({ goalId: other.goal.id, missions, userId: user.id }),
    ]);

    await goalActivityFixture({
      goalId: mine.goal.id,
      skillId: mine.skills[0]?.id,
      userId: user.id,
    });

    const [mineMissions, otherMissions] = await Promise.all([
      readMissions(mineDay.id),
      readMissions(otherDay.id),
    ]);

    expect(mineMissions.map((mission) => [mission.kind, mission.status])).toStrictEqual([
      ["askBuddy", "done"],
      ["call", "done"],
      ["pronunciation", "done"],
      ["fixMistake", "done"],
    ]);

    expect(otherMissions.map((mission) => [mission.kind, mission.status])).toStrictEqual([
      ["askBuddy", "todo"],
      ["call", "todo"],
      ["pronunciation", "todo"],
      ["fixMistake", "todo"],
    ]);
  });
});

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
