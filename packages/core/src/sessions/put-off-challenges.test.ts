import { type Goal, type StudySessionBlock, prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChallengeTimings } from "../checkpoints/_utils/challenge-timing";
import { findLastCheckpointResults } from "../checkpoints/_utils/checkpoint-results";
import { getCheckpointMinutes } from "../checkpoints/checkpoint-minutes";
import { parsePlanSettings } from "../plans/planner/plan-state";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { getSessionChallenges } from "./_utils/day-stretch";
import { loadSessionBuildInput } from "./_utils/load-build-inputs";
import { planStudyDay } from "./_utils/plan-study-day";
import { readSavedDayPlan } from "./_utils/saved-day-plan";
import { toBlockPayload } from "./block-payload";
import { type PlannedBlock, buildSessionBlocks } from "./session-builder";

const YESTERDAY = new Date(SESSION_TODAY.getTime() - DAY_MS);

async function buildAndSaveDay({
  goal,
  index,
  userId,
}: {
  goal: Parameters<typeof loadSessionBuildInput>[0]["goal"];
  index: number;
  userId: string;
}): Promise<PlannedBlock[]> {
  const now = new Date(SESSION_NOW.getTime() + index * DAY_MS);
  const localDate = new Date(SESSION_TODAY.getTime() + index * DAY_MS);
  vi.setSystemTime(now);

  const built = buildSessionBlocks(
    await loadSessionBuildInput({ goal, localDate, now, timeZone: "UTC", userId }),
  );

  const session = await studySessionFixture({
    goalId: goal.id,
    localDate,
    plannedMinutes: built.plannedMinutes,
    userId,
  });

  await prisma.studySessionBlock.createMany({
    data: built.blocks.map((block, position) => ({ ...block, position, sessionId: session.id })),
  });

  return built.blocks;
}

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

/** Today's blocks as Today builds them, and the Plan's timing for the day it hasn't built yet. */
async function openTodayAndPlan({
  goal,
  lastSession,
  planId,
}: {
  goal: Goal;
  lastSession: readonly Pick<StudySessionBlock, "payload" | "startedAt">[];
  planId: string;
}) {
  const saved = await prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });

  const selection = await readSavedDayPlan({ goal, now: SESSION_NOW, saved, timeZone: "UTC" });

  if (!selection) {
    throw new Error("Expected today's saved plan");
  }

  const [day, results] = await Promise.all([
    planStudyDay({
      goal,
      localDate: SESSION_TODAY,
      now: SESSION_NOW,
      selection,
      timeZone: "UTC",
      userId: goal.userId,
    }),
    findLastCheckpointResults({
      planItemIds: saved.items.flatMap((item) => (item.kind === "boss" ? [item.id] : [])),
      userId: goal.userId,
    }),
  ]);

  return {
    timings: getChallengeTimings({
      goal,
      items: saved.items,
      lastSessionChallenges: getSessionChallenges(lastSession),
      results,
      settings: parsePlanSettings(saved.settings),
      today: SESSION_TODAY,
    }),
    today: day.blocks.map((block) => block.payload.planItemId),
  };
}

describe("a challenge the learner didn't start", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it.each([15, 45])("goes after the lessons the next day (%i-minute days)", async (minutes) => {
    const user = await userFixture();

    const { goal, plan, planItems } = await sessionGoalFixture({
      goal: { dailyMinutes: minutes },
      itemsPerSkill: 10,
      userId: user.id,
    });

    await prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]!.id } });

    await prisma.planItem.updateMany({
      data: { phase: 1, position: { increment: 2 } },
      where: { id: { in: planItems.slice(1).map((item) => item.id) } },
    });

    const boss = await checkpointItemFixture({ kind: "boss", planId: plan.id, position: 1 });

    const followsLessons = (day: PlannedBlock[]) =>
      day.findIndex((block) => block.payload.planItemId === boss.id) >
      day.findLastIndex((block) => block.kind === "learn");

    const first = await buildAndSaveDay({ goal, index: 0, userId: user.id });
    const second = await buildAndSaveDay({ goal, index: 1, userId: user.id });
    const third = await buildAndSaveDay({ goal, index: 2, userId: user.id });

    expect(first[0]?.payload.planItemId).toBe(boss.id);
    expect(second[0]?.kind).toBe("learn");
    expect(followsLessons(second)).toBe(minutes === 45);
    expect(third[0]?.kind).toBe(minutes === 15 ? "checkpoint" : "learn");
    expect(third.some((block) => block.payload.planItemId === boss.id)).toBe(true);
  });

  it("isn't promised for the next session when Today brings later lessons ahead of it", async () => {
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

    const held = await heldChallengeFixture({ planItemId: boss.id, sessionId: yesterday.id });

    const { timings, today } = await openTodayAndPlan({
      goal,
      lastSession: [held],
      planId: plan.id,
    });

    expect(today).not.toContain(boss.id);
    expect(timings.get(boss.id)?.when).toBe("date");
  });

  it("isn't promised behind a lost duel, whose rematch is", async () => {
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

    const endedAt = new Date(SESSION_NOW.getTime() - DAY_MS);
    const asked = items.filter((item) => item.skillId === skills[0]!.id);

    const [duel, unstarted] = await Promise.all([
      heldChallengeFixture({
        itemIds: asked.map((item) => item.id),
        planItemId: lost.id,
        position: 0,
        sessionId: yesterday.id,
        startedAt: endedAt,
        status: "completed",
      }),
      heldChallengeFixture({ planItemId: putOff.id, position: 1, sessionId: yesterday.id }),
    ]);

    await Promise.all([
      attemptFixture({
        answeredAt: endedAt,
        isCorrect: false,
        itemId: asked[0]!.id,
        skillId: skills[0]!.id,
        studySessionId: yesterday.id,
        userId: user.id,
      }),
      learningEventFixture({
        contentIds: {
          planItemId: lost.id,
          studySessionBlockId: duel.id,
          studySessionId: yesterday.id,
        },
        correctAnswers: 3,
        endedAt,
        goalId: goal.id,
        incorrectAnswers: 7,
        kind: "checkpoint",
        userId: user.id,
      }),
    ]);

    const { timings, today } = await openTodayAndPlan({
      goal,
      lastSession: [duel, unstarted],
      planId: plan.id,
    });

    expect(today).toContain(lost.id);
    expect(today).not.toContain(putOff.id);
    expect(timings.get(lost.id)?.when).toBe("nextSession");
    expect(timings.get(putOff.id)?.when).toBe("date");
  });
});
