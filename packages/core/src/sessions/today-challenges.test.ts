import { type Goal, type StudySessionBlock, prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { isPhaseChallenge } from "../checkpoints/_utils/challenge-reach";
import { getCheckpointMinutes } from "../checkpoints/checkpoint-minutes";
import { getChallenge } from "../checkpoints/get-challenge";
import { getAlphabetIdentityKey } from "../library/language/alphabet/alphabet-identity";
import { getGoalPlan } from "../plans/get-goal-plan";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { loadSessionBuildInput } from "./_utils/load-build-inputs";
import { planStudyDay } from "./_utils/plan-study-day";
import { readSavedDayPlan } from "./_utils/saved-day-plan";
import { readBlockPayload, toBlockPayload } from "./block-payload";
import { getStoredBlockWait } from "./block-wait";
import { ensureStudySession } from "./ensure-study-session";
import { buildSessionBlocks } from "./session-builder";

const YESTERDAY = new Date(SESSION_TODAY.getTime() - DAY_MS);

async function sizeChallenge({
  id,
  minutes,
  skillId,
}: {
  id: string;
  minutes: number;
  skillId: string;
}) {
  await prisma.planItem.update({
    data: {
      facts: {
        boss: {
          kind: "text",
          minutes,
          questions: 10,
          testedKeys: [],
          testedSkillIds: [skillId],
          waiting: false,
        },
        minutes,
        parts: { checkpoint: minutes, practice: 0, unwritten: 0, written: 0 },
        schemaVersion: 1,
        skillIds: [],
      },
      minutes,
    },
    where: { id },
  });
}

function heldChallengeFixture({
  itemIds = [],
  planItemId,
  sessionId,
  ...block
}: Partial<Pick<StudySessionBlock, "position" | "startedAt" | "status">> & {
  itemIds?: string[];
  planItemId: string;
  sessionId: string;
}) {
  return studySessionBlockFixture({
    ...block,
    kind: "checkpoint",
    payload: toBlockPayload({
      checkpoint: {
        kind: "boss",
        mock: false,
        passMark: 7,
        phase: 0,
        rematch: false,
        timeLimitMinutes: null,
      },
      itemIds,
      planItemId,
    }),
    sessionId,
  });
}

async function lostDuelFixture({
  asked,
  goal,
  planItemId,
  position,
  sessionId,
}: {
  asked: { id: string; skillId: string }[];
  goal: Goal;
  planItemId: string;
  position: number;
  sessionId: string;
}) {
  const endedAt = new Date(SESSION_NOW.getTime() - DAY_MS);

  const duel = await heldChallengeFixture({
    itemIds: asked.map((item) => item.id),
    planItemId,
    position,
    sessionId,
    startedAt: endedAt,
    status: "completed",
  });

  await Promise.all([
    attemptFixture({
      answeredAt: endedAt,
      isCorrect: false,
      itemId: asked[0]!.id,
      skillId: asked[0]!.skillId,
      studySessionId: sessionId,
      userId: goal.userId,
    }),
    learningEventFixture({
      contentIds: { planItemId, studySessionBlockId: duel.id, studySessionId: sessionId },
      correctAnswers: 3,
      endedAt,
      goalId: goal.id,
      incorrectAnswers: 7,
      kind: "checkpoint",
      userId: goal.userId,
    }),
  ]);
}

function listPhaseChallenges(blocks: readonly Pick<StudySessionBlock, "payload">[]): string[] {
  return blocks
    .flatMap((block) => {
      const { checkpoint, planItemId } = readBlockPayload(block);
      return isPhaseChallenge(checkpoint) && planItemId ? [planItemId] : [];
    })
    .toSorted();
}

async function readToday({ goal, planId }: { goal: Goal; planId: string }) {
  // A plan the learner has seen is laid out, so Start keeps it instead of re-planning the fixture.
  await Promise.all([
    prisma.plan.update({
      data: { phases: [{ name: "Basics", startDate: "2026-09-30" }, { name: "Practice" }] },
      where: { id: planId },
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: goal.userId }),
  ]);

  mockSession(goal.userId);

  const saved = await prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });

  const selection = await readSavedDayPlan({ goal, now: SESSION_NOW, saved, timeZone: "UTC" });

  if (!selection) {
    throw new Error("Expected today's saved plan");
  }

  const [day, view, screens] = await Promise.all([
    planStudyDay({
      goal,
      localDate: SESSION_TODAY,
      now: SESSION_NOW,
      selection,
      timeZone: "UTC",
      userId: goal.userId,
    }),
    getGoalPlan(goal.id),
    Promise.all(
      saved.items
        .filter((item) => item.kind === "boss")
        .map((item) => getChallenge({ input: { timeZone: "UTC" }, planItemId: item.id })),
    ),
  ]);

  if (view.status !== "ready") {
    throw new Error(`Expected the Plan, received ${view.status}`);
  }

  const started = await ensureStudySession({
    goal,
    localDate: SESSION_TODAY,
    timeZone: "UTC",
    userId: goal.userId,
  });

  const offered = screens.flatMap((screen) =>
    screen.status === "ready" && screen.challenge.status === "ready" ? [screen.challenge] : [],
  );

  return {
    built: listPhaseChallenges(started.blocks),
    held: listPhaseChallenges(day.blocks),
    offered: offered.map((challenge) => challenge.planItemId).toSorted(),
    offeredAfterLessons: offered
      .flatMap((challenge) => (challenge.waitReason === "lessons" ? [challenge.planItemId] : []))
      .toSorted(),
    promised: view.plan.phases
      .flatMap((phase) =>
        phase.checkpoint?.when === "nextSession" && phase.checkpoint.planItemId
          ? [phase.checkpoint.planItemId]
          : [],
      )
      .toSorted(),
    startedAfterLessons: listPhaseChallenges(
      started.blocks.filter(
        (block) => getStoredBlockWait({ block, blocks: started.blocks }) === "lessons",
      ),
    ),
  };
}

/** The challenges Today holds, and those of them that wait for the day's lessons. */
/** Today, the Plan, the challenge screen and Start all hold `held`; `afterLessons` of them wait for the day's lessons. */
function todayHolding({ afterLessons = [], held }: { afterLessons?: string[]; held: string[] }) {
  const holds = held.toSorted();
  const waits = afterLessons.toSorted();

  return {
    built: holds,
    held: holds,
    offered: holds,
    offeredAfterLessons: waits,
    promised: holds,
    startedAfterLessons: waits,
  };
}

describe("the Plan and the challenge screen read today from Today", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("doesn't promise a challenge put off yesterday when Today brings later lessons ahead of it", async () => {
    const user = await userFixture();

    const { goal, lessons, plan, planItems, skills } = await sessionGoalFixture({
      goal: { dailyMinutes: 15 },
      itemsPerSkill: 10,
      userId: user.id,
    });

    await Promise.all([
      prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]!.id } }),
      prisma.planItem.updateMany({
        data: {
          minutes: 15,
          phase: 1,
          position: { increment: 2 },
          scheduledFor: new Date(SESSION_TODAY.getTime() + 2 * DAY_MS),
        },
        where: { id: { in: planItems.slice(1).map((item) => item.id) } },
      }),
      prisma.lesson.updateMany({
        data: { estimatedMinutes: 15 },
        where: { id: { in: lessons.map((lesson) => lesson.id) } },
      }),
    ]);

    const boss = await checkpointItemFixture({ kind: "boss", planId: plan.id, position: 1 });
    await sizeChallenge({ id: boss.id, minutes: getCheckpointMinutes(10), skillId: skills[0]!.id });

    const yesterday = await studySessionFixture({
      goalId: goal.id,
      localDate: YESTERDAY,
      userId: user.id,
    });

    await heldChallengeFixture({ planItemId: boss.id, sessionId: yesterday.id });

    await expect(readToday({ goal, planId: plan.id })).resolves.toStrictEqual(
      todayHolding({ held: [] }),
    );
  });

  it("promises a lost duel's rematch, not the challenge put off behind it", async () => {
    const user = await userFixture();

    const { goal, items, lessons, plan, planItems, skills } = await sessionGoalFixture({
      itemsPerSkill: 10,
      userId: user.id,
    });

    const [lost, putOff] = await Promise.all([
      checkpointItemFixture({ kind: "boss", phase: 0, planId: plan.id, position: 5 }),
      checkpointItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 15 }),
    ]);

    await Promise.all([
      prisma.planItem.update({
        data: { phase: 0, position: 0, status: "done" },
        where: { id: planItems[0]!.id },
      }),
      prisma.planItem.update({
        data: { phase: 1, position: 10, status: "done" },
        where: { id: planItems[1]!.id },
      }),
      prisma.planItem.update({
        data: { minutes: 15, phase: 2, position: 20, scheduledFor: SESSION_TODAY },
        where: { id: planItems[2]!.id },
      }),
      prisma.lesson.updateMany({
        data: { estimatedMinutes: 15 },
        where: { id: { in: lessons.map((lesson) => lesson.id) } },
      }),
      sizeChallenge({ id: lost.id, minutes: 15, skillId: skills[0]!.id }),
      sizeChallenge({ id: putOff.id, minutes: 15, skillId: skills[1]!.id }),
    ]);

    const yesterday = await studySessionFixture({
      goalId: goal.id,
      localDate: YESTERDAY,
      userId: user.id,
    });

    await Promise.all([
      lostDuelFixture({
        asked: items.filter((item) => item.skillId === skills[0]!.id),
        goal,
        planItemId: lost.id,
        position: 0,
        sessionId: yesterday.id,
      }),
      heldChallengeFixture({ planItemId: putOff.id, position: 1, sessionId: yesterday.id }),
    ]);

    await expect(readToday({ goal, planId: plan.id })).resolves.toStrictEqual(
      todayHolding({ afterLessons: [lost.id], held: [lost.id] }),
    );
  });

  it("promises both an earlier rematch and a later first duel when Today holds both", async () => {
    const user = await userFixture();

    const { goal, items, lessons, plan, planItems, skills } = await sessionGoalFixture({
      itemsPerSkill: 10,
      userId: user.id,
    });

    const [rematch, firstDuel] = await Promise.all([
      checkpointItemFixture({ kind: "boss", phase: 0, planId: plan.id, position: 5 }),
      checkpointItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 15 }),
    ]);

    await Promise.all([
      prisma.planItem.update({
        data: { phase: 0, position: 0, status: "done" },
        where: { id: planItems[0]!.id },
      }),
      prisma.planItem.update({
        data: { phase: 1, position: 10, status: "done" },
        where: { id: planItems[1]!.id },
      }),
      prisma.planItem.update({
        data: { minutes: 15, phase: 2, position: 20 },
        where: { id: planItems[2]!.id },
      }),
      prisma.lesson.updateMany({
        data: { estimatedMinutes: 15 },
        where: { id: { in: lessons.map((lesson) => lesson.id) } },
      }),
      sizeChallenge({ id: rematch.id, minutes: 15, skillId: skills[0]!.id }),
      sizeChallenge({ id: firstDuel.id, minutes: 15, skillId: skills[1]!.id }),
    ]);

    const yesterday = await studySessionFixture({
      goalId: goal.id,
      localDate: YESTERDAY,
      userId: user.id,
    });

    await lostDuelFixture({
      asked: items.filter((item) => item.skillId === skills[0]!.id),
      goal,
      planItemId: rematch.id,
      position: 0,
      sessionId: yesterday.id,
    });

    await expect(readToday({ goal, planId: plan.id })).resolves.toStrictEqual(
      todayHolding({ afterLessons: [rematch.id, firstDuel.id], held: [rematch.id, firstDuel.id] }),
    );
  });

  it("promises the challenge a put-off day reaches after its lessons, not the put-off one", async () => {
    const user = await userFixture();

    const { goal, items, lessons, plan, planItems, skills } = await sessionGoalFixture({
      goal: { dailyMinutes: 15 },
      itemsPerSkill: 10,
      userId: user.id,
    });

    const [putOff, reachedLater] = await Promise.all([
      checkpointItemFixture({ kind: "boss", phase: 0, planId: plan.id, position: 5 }),
      checkpointItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 15 }),
    ]);

    await Promise.all([
      prisma.planItem.update({
        data: { minutes: 4, phase: 0, position: 0 },
        where: { id: planItems[0]!.id },
      }),
      prisma.planItem.update({
        data: { minutes: 1, phase: 1, position: 10 },
        where: { id: planItems[1]!.id },
      }),
      prisma.planItem.update({
        data: { minutes: 1, phase: 2, position: 20 },
        where: { id: planItems[2]!.id },
      }),
      prisma.lesson.updateMany({
        data: { estimatedMinutes: 1 },
        where: { id: { in: lessons.map((lesson) => lesson.id) } },
      }),
      prisma.item.deleteMany({
        where: {
          id: {
            in: items
              .filter((item) => item.skillId === skills[1]!.id)
              .slice(5)
              .map((item) => item.id),
          },
        },
      }),
      sizeChallenge({ id: putOff.id, minutes: 15, skillId: skills[0]!.id }),
      sizeChallenge({ id: reachedLater.id, minutes: 8, skillId: skills[1]!.id }),
    ]);

    await prisma.lesson.update({
      data: { estimatedMinutes: 4 },
      where: { id: planItems[0]!.lessonId! },
    });

    // Yesterday's real build: the first three lessons and the later challenge fit, the 15-minute one doesn't.
    const yesterdayNow = new Date(SESSION_NOW.getTime() - DAY_MS);
    vi.setSystemTime(yesterdayNow);

    const yesterdayBlocks = buildSessionBlocks(
      await loadSessionBuildInput({
        goal,
        localDate: YESTERDAY,
        now: yesterdayNow,
        timeZone: "UTC",
        userId: user.id,
      }),
    ).blocks;

    expect(listPhaseChallenges(yesterdayBlocks)).toStrictEqual([reachedLater.id]);

    const yesterday = await studySessionFixture({
      goalId: goal.id,
      localDate: YESTERDAY,
      userId: user.id,
    });

    await prisma.studySessionBlock.createMany({
      data: yesterdayBlocks.map((block, position) => ({
        ...block,
        position,
        sessionId: yesterday.id,
        ...(block.payload.planItemId === planItems[0]!.id
          ? { completedAt: yesterdayNow, startedAt: yesterdayNow, status: "completed" as const }
          : {}),
      })),
    });

    await prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]!.id } });
    vi.setSystemTime(SESSION_NOW);

    await expect(readToday({ goal, planId: plan.id })).resolves.toStrictEqual(
      todayHolding({ afterLessons: [reachedLater.id], held: [reachedLater.id] }),
    );
  });

  it("promises a language challenge that follows a pending alphabet lesson", async () => {
    const user = await userFixture();

    const { goal, plan, planItems, skills } = await sessionGoalFixture({
      goal: { dailyMinutes: 45, kind: "language", language: "en", targetLanguage: "ja" },
      itemsPerSkill: 10,
      userId: user.id,
    });

    const [alphabet, boss] = await Promise.all([
      prisma.lesson.findUnique({
        where: { languageIdentity: { identityKey: getAlphabetIdentityKey("ja"), language: "en" } },
      }),
      checkpointItemFixture({ kind: "boss", phase: 0, planId: plan.id, position: 5 }),
    ]);

    await Promise.all([
      alphabet ??
        libraryLessonFixture({
          contentStatus: "completed",
          estimatedMinutes: 5,
          identityKey: getAlphabetIdentityKey("ja"),
          language: "en",
          targetLanguage: "ja",
        }),
      prisma.planItem.update({
        data: { phase: 0, position: 0, status: "done" },
        where: { id: planItems[0]!.id },
      }),
      prisma.planItem.updateMany({
        data: { phase: 1 },
        where: { id: { in: planItems.slice(1).map((item) => item.id) } },
      }),
      prisma.planItem.update({ data: { position: 10 }, where: { id: planItems[1]!.id } }),
      prisma.planItem.update({ data: { position: 20 }, where: { id: planItems[2]!.id } }),
      sizeChallenge({ id: boss.id, minutes: 6, skillId: skills[0]!.id }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
    ]);

    await expect(readToday({ goal, planId: plan.id })).resolves.toStrictEqual(
      todayHolding({ afterLessons: [boss.id], held: [boss.id] }),
    );
  });

  it("doesn't promise a challenge on a free learner's shared mock day, which becomes a full review", async () => {
    const user = await userFixture();

    const { goal, plan, planItems, skills } = await sessionGoalFixture({
      goal: {
        dailyMinutes: 45,
        kind: "exam",
        targetDate: new Date(SESSION_TODAY.getTime() + DAY_MS),
      },
      itemsPerSkill: 10,
      userId: user.id,
    });

    const boss = await checkpointItemFixture({
      kind: "boss",
      phase: 0,
      planId: plan.id,
      position: 5,
    });

    await Promise.all([
      prisma.planItem.update({
        data: { phase: 0, position: 0, status: "done" },
        where: { id: planItems[0]!.id },
      }),
      prisma.planItem.update({ data: { phase: 1, position: 10 }, where: { id: planItems[1]!.id } }),
      prisma.planItem.update({ data: { phase: 1, position: 20 }, where: { id: planItems[2]!.id } }),
      prisma.plan.update({
        data: { settings: { fullCourse: true, shortMockMinutes: 10, startDate: "2026-09-30" } },
        where: { id: plan.id },
      }),
      checkpointItemFixture({ kind: "mock", phase: 1, planId: plan.id, position: 30 }),
      sizeChallenge({ id: boss.id, minutes: 15, skillId: skills[0]!.id }),
    ]);

    await expect(readToday({ goal, planId: plan.id })).resolves.toStrictEqual(
      todayHolding({ held: [] }),
    );
  });
});
