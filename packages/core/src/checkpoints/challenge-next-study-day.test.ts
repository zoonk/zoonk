import { type PlanItem, prisma } from "@zoonk/db";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { readSelectedItemFacts } from "../plans/_utils/selected-item-contract";
import { createGoalPlan } from "../plans/create-goal-plan";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { MIN_CHECKPOINT_QUESTIONS } from "./checkpoint-rules";
import { getChallenge } from "./get-challenge";

const DAY_MS = 86_400_000;
const LEARN_KINDS: PlanItem["kind"][] = ["chapter", "lesson"];

const EXAM_STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "Right answers", method: "raw" },
    sections: [{ day: null, minutes: 30, name: "Math", questions: 18 }],
    timeLimitMinutes: 30,
    totalQuestions: 18,
  },
  rules: [],
  subjects: [],
};

/** An exam whose first day is an hour: its regular mock takes half of it, 30 minutes. */
const HOUR_EXAM_STRUCTURE = {
  ...EXAM_STRUCTURE,
  mock: {
    ...EXAM_STRUCTURE.mock,
    sections: [{ day: null, minutes: 60, name: "Math", questions: 36 }],
    timeLimitMinutes: 60,
    totalQuestions: 36,
  },
};

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

/** A dated exam's plan, with Plus (its phase challenges after the first week are Plus's). */
async function datedExamPlanFixture({
  dailyMinutes = 60,
  structure = EXAM_STRUCTURE,
  targetDate = new Date("2020-12-18"),
}: { dailyMinutes?: number; structure?: typeof EXAM_STRUCTURE; targetDate?: Date } = {}) {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure }),
    planLibraryFixture({ skills: [{ area: "Math", lessons: 40 }] }),
  ]);

  await Promise.all([
    questionBankFixture(library.skills[0]?.id ?? ""),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: new Date("2020-09-28"),
    dailyMinutes,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate,
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, plan, user };
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

describe("a phase challenge past today's study time names the day the plan's next run puts it on", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("on a learn plan, past a weekly checkpoint day its 15 minutes leave no lesson time on", async () => {
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

  it("on a dated exam's plan, past a weekly mock's own day", async () => {
    // A Monday in 2020, before other tests' learning events, so the planner's pace is its own.
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));
    const { goal, plan, user } = await datedExamPlanFixture();

    const [boss, saved] = await Promise.all([
      findPhaseChallenge({ phase: 0, planId: plan.id }),
      prisma.plan.findUniqueOrThrow({ include: { items: true }, where: { id: plan.id } }),
    ]);

    // A day a mock was moved onto can hold a challenge too; a mock's own day can't.
    const { mockRelocations, movedEvents } = parsePlanSettings(saved.settings);
    const movedTo = new Set([...movedEvents, ...mockRelocations].map((move) => move.to));

    const mockDay = saved.items
      .flatMap((item) =>
        item.kind === "mock" && item.scheduledFor && item.scheduledFor > boss.scheduledFor
          ? [item.scheduledFor]
          : [],
      )
      .filter((date) => !movedTo.has(toIsoDate(date)))
      .toSorted((a, b) => a.getTime() - b.getTime())
      .at(0);

    if (!mockDay) {
      throw new Error("Expected a weekly mock after the first phase's challenge");
    }

    const today = new Date(mockDay.getTime() - DAY_MS);

    // The learner kept up: every lesson before today is done, and the first phase's challenge is
    // today, the day before a mock.
    await Promise.all([
      prisma.planItem.updateMany({
        data: { completedAt: new Date(today.getTime() - DAY_MS / 2), status: "done" },
        where: { kind: { in: LEARN_KINDS }, planId: plan.id, scheduledFor: { lt: today } },
      }),
      prisma.planItem.update({ data: { scheduledFor: today }, where: { id: boss.id } }),
    ]);

    vi.setSystemTime(noonOn(today));
    await useUpStudyTime({ date: today, userId: user.id });

    const held = await challengeOf(boss.id);

    expect(held).toMatchObject({
      dailyLimitReached: true,
      status: "ready",
      today: toIsoDate(today),
    });

    await openTheNextDay({ date: mockDay, goalId: goal.id });
    const replanned = await findPhaseChallenge({ phase: 0, planId: plan.id });

    // Tomorrow has study time, but the mock takes the day whole: the challenge comes after it.
    expect(toIsoDate(replanned.scheduledFor)).not.toBe(toIsoDate(mockDay));
    expect(held.nextStudyDate).toBe(toIsoDate(replanned.scheduledFor));
  });

  it("on a dated exam's plan, past a day the next mock takes whole", async () => {
    // A Monday in 2020, before other tests' learning events, so the planner's pace is its own.
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));

    const friday = new Date("2020-10-16T00:00:00Z");
    const saturday = new Date("2020-10-17T00:00:00Z");
    const sunday = new Date("2020-10-18T00:00:00Z");

    // 15 minutes every day: the first phase runs to Monday the 19th, and its regular mock is 30.
    const { goal, plan, user } = await datedExamPlanFixture({
      dailyMinutes: 15,
      structure: HOUR_EXAM_STRUCTURE,
      targetDate: new Date("2020-12-22"),
    });

    const carried = await findPhaseChallenge({ phase: 0, planId: plan.id });

    // The first phase's lessons all done on Friday, none of its mocks taken, and its challenge left
    // from Friday: Saturday's open re-plans it (it's overdue, see `hasOverduePlanWork`).
    await Promise.all([
      prisma.planItem.updateMany({
        data: { completedAt: noonOn(friday), scheduledFor: friday, status: "done" },
        where: { kind: { in: LEARN_KINDS }, phase: 0, planId: plan.id },
      }),
      prisma.planItem.update({ data: { scheduledFor: friday }, where: { id: carried.id } }),
    ]);

    // Saturday's run puts the challenge on Saturday, which it takes whole, and gives the phase a
    // mock of its own on Monday, its last study day, which all of Sunday's 15 minutes fund.
    await openTheNextDay({ date: saturday, goalId: goal.id });

    const [boss, saved] = await Promise.all([
      findPhaseChallenge({ phase: 0, planId: plan.id }),
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
    ]);

    expect(toIsoDate(boss.scheduledFor)).toBe("2020-10-17");

    expect(
      parsePlanSettings(saved.settings).mockFunding.find((entry) => entry.date === "2020-10-19"),
    ).toMatchObject({ contributions: [{ date: "2020-10-18", minutes: 15 }] });

    await useUpStudyTime({ date: saturday, userId: user.id });

    const held = await challengeOf(boss.id);
    expect(held).toMatchObject({ dailyLimitReached: true, status: "ready", today: "2020-10-17" });

    await openTheNextDay({ date: sunday, goalId: goal.id });
    const replanned = await findPhaseChallenge({ phase: 0, planId: plan.id });

    // Sunday has study time, but Monday's mock takes all of it: the challenge comes after them.
    expect(toIsoDate(replanned.scheduledFor)).not.toBe(toIsoDate(sunday));
    expect(held.nextStudyDate).toBe(toIsoDate(replanned.scheduledFor));
  });

  it("on a dated exam's plan, names no day for a phase that teaches nothing of its own", async () => {
    // A Monday in 2020, before other tests' learning events, so the planner's pace is its own.
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));
    const { goal, plan, user } = await datedExamPlanFixture();

    const saved = await prisma.plan.findUniqueOrThrow({
      include: { items: true },
      where: { id: plan.id },
    });

    const taught = new Set(
      saved.items.flatMap((item) => (LEARN_KINDS.includes(item.kind) ? [item.phase] : [])),
    );

    // A window of practice and mocks: its challenge asks earlier phases' lessons, none of its own.
    const boss = saved.items.find(
      (item) =>
        item.kind === "boss" &&
        item.status === "todo" &&
        !taught.has(item.phase) &&
        (readSelectedItemFacts(item.facts)?.boss?.testedKeys.length ?? 0) > 0,
    );

    if (!boss?.scheduledFor) {
      throw new Error("Expected a challenge for a phase that teaches nothing of its own");
    }

    const today = boss.scheduledFor;

    // The learner kept up: every lesson and challenge before today is done.
    await prisma.planItem.updateMany({
      data: { completedAt: new Date(today.getTime() - DAY_MS / 2), status: "done" },
      where: {
        kind: { in: [...LEARN_KINDS, "boss"] },
        planId: plan.id,
        scheduledFor: { lt: today },
      },
    });

    vi.setSystemTime(noonOn(today));
    await useUpStudyTime({ date: today, userId: user.id });

    // Its runs put it where what it asks from earlier phases settles, which no day tells: the
    // screen names no day rather than guess one.
    await expect(challengeOf(boss.id)).resolves.toMatchObject({
      dailyLimitReached: true,
      goalId: goal.id,
      nextStudyDate: null,
      status: "ready",
    });
  });
});
