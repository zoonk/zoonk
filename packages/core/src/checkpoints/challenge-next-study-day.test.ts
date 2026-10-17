import { type PlanItem, prisma } from "@zoonk/db";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { MIN_CHECKPOINT_QUESTIONS } from "./checkpoint-rules";
import { getChallenge } from "./get-challenge";

const DAY_MS = 86_400_000;
const LEARN_KINDS: PlanItem["kind"][] = ["chapter", "lesson"];

/** Noon on a learner-local date, so the clock reads that day in UTC. */
function noonOn(date: Date): Date {
  return new Date(date.getTime() + DAY_MS / 2);
}

/** Questions on a skill, so its phase's challenge can be asked. */
function questionBankFixture(skillId: string) {
  return Promise.all(
    Array.from({ length: MIN_CHECKPOINT_QUESTIONS + 1 }, () =>
      itemFixture({ content: choiceItemContent(), skillId }),
    ),
  );
}

/** Today's study time under a 30-minute daily limit, all of it used on `date`. */
async function useUpStudyTime({ date, userId }: { date: Date; userId: string }) {
  await Promise.all([
    prisma.userLearningProfile.upsert({
      create: { dailyLimitMinutes: 30, userId },
      update: { dailyLimitMinutes: 30 },
      where: { userId },
    }),
    dailyProgressFixtureMany([{ date, timeSpentSeconds: 30 * 60, userId }]),
  ]);
}

async function challengeOf(planItemId: string) {
  const result = await getChallenge({ input: {}, planItemId });

  if (result.status !== "ready") {
    throw new Error(`Expected the challenge, got ${result.status}`);
  }

  return result.challenge;
}

/** A phase's challenge still to win, on the day the plan saved it. */
async function findPhaseChallenge({ phase, planId }: { phase: number; planId: string }) {
  const boss = await prisma.planItem.findFirst({
    where: { kind: "boss", phase, planId, status: "todo" },
  });

  if (!boss?.scheduledFor) {
    throw new Error(`Expected phase ${phase}'s challenge on a day`);
  }

  return { ...boss, scheduledFor: boss.scheduledFor };
}

/**
 * The day after its day, Today's first open re-plans the challenge the daily limit held back (it's
 * overdue, see `hasOverduePlanWork`): that run's day is the one the challenge's screen promised.
 */
async function openTheNextDay({ date, goalId }: { date: Date; goalId: string }) {
  vi.setSystemTime(noonOn(date));

  await expect(getTodayStudySession({ goalId, timeZone: "UTC" })).resolves.toMatchObject({
    status: "ready",
  });
}

describe("a learn plan's phase challenge past today's study time names the day its next run puts it on", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("past a weekly checkpoint day its 15 minutes leave no lesson time on", async () => {
    // A Monday in 2020, before other tests' learning events, so the planner's pace is its own.
    vi.setSystemTime(new Date("2020-10-05T12:00:00Z"));

    const friday = new Date("2020-10-09T12:00:00Z");
    const saturday = new Date("2020-10-10T00:00:00Z");
    const sunday = new Date("2020-10-11T00:00:00Z");

    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({
        phases: ["Basics", "Next steps"],
        skills: [
          { lessons: 30, phase: 0 },
          { lessons: 10, phase: 1 },
        ],
      }),
    ]);

    await questionBankFixture(library.skills[0]?.id ?? "");

    // 15 minutes every day, the shortest onboarding preset, since the week before: from its second
    // week on, each Sunday holds the week's checkpoint, which takes those 15 minutes.
    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 15,
      details: { placementDeclined: true },
      settings: { startDate: "2020-09-28" },
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const boss = await findPhaseChallenge({ phase: 0, planId: plan.id });

    // The first phase's lessons done by Friday, its challenge on Saturday, the next study day.
    await Promise.all([
      prisma.planItem.updateMany({
        data: { completedAt: friday, status: "done" },
        where: { kind: { in: LEARN_KINDS }, phase: 0, planId: plan.id },
      }),
      prisma.planItem.update({ data: { scheduledFor: saturday }, where: { id: boss.id } }),
    ]);

    // No lesson is left from before Sunday, so Sunday's run carries none in ahead of the challenge,
    // and Sunday holds the week's checkpoint.
    await expect(
      prisma.planItem.count({
        where: {
          kind: { in: LEARN_KINDS },
          planId: plan.id,
          scheduledFor: { lt: sunday },
          status: "todo",
        },
      }),
    ).resolves.toBe(0);

    await expect(
      prisma.planItem.count({
        where: { kind: "checkpoint", planId: plan.id, scheduledFor: sunday },
      }),
    ).resolves.toBe(1);

    vi.setSystemTime(noonOn(saturday));
    await useUpStudyTime({ date: saturday, userId: user.id });

    const held = await challengeOf(boss.id);
    expect(held).toMatchObject({ dailyLimitReached: true, status: "ready", today: "2020-10-10" });

    await openTheNextDay({ date: sunday, goalId: goal.id });
    const replanned = await findPhaseChallenge({ phase: 0, planId: plan.id });

    // Sunday has study time, but the week's checkpoint takes all of it: the challenge isn't there.
    expect(toIsoDate(replanned.scheduledFor)).not.toBe(toIsoDate(sunday));
    expect(held.nextStudyDate).toBe(toIsoDate(replanned.scheduledFor));
  });
});
