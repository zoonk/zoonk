import { prisma } from "@zoonk/db";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChallenge } from "../checkpoints/get-challenge";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { takenChallengeFixture } from "./_test-utils/taken-challenge";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { addDays, fromIsoDate, toIsoDate } from "./planner/plan-calendar";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** A Sunday in 2020, before other tests' learning events: this week is only today. */
const SUNDAY = new Date("2020-09-27T12:00:00Z");

const FAR = new Date("2020-12-31T00:00:00Z");

const TIGHT = new Date("2020-10-16T00:00:00Z");

const LAST_WEEK = new Date("2020-09-20T00:00:00Z");

type Outline = { count: number; minutes: number };

const SKILLS = [
  { lessons: 4, phase: 0 },
  { lessons: 0, phase: 0, size: 10 },
  { lessons: 6, phase: 1 },
  { lessons: 0, phase: 1, size: 5 },
];

async function setup({
  challengeTaken = true,
  skills = SKILLS,
  targetDate,
}: {
  challengeTaken?: boolean;
  skills?: typeof SKILLS;
  targetDate: Date;
}) {
  const user = await userFixture();
  const library = await planLibraryFixture({ phases: ["Basics", "Projects"], skills });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-27" },
    targetDate,
    timezone: "UTC",
    userId: user.id,
  });

  if (challengeTaken) {
    await takenChallengeFixture({ date: LAST_WEEK, planId: plan.id });
  }

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const outline = async ({ outline: lessons, skill }: { outline: Outline; skill: number }) => {
    const spec = library.graph.skills[skill];
    const chapterId = library.chapters[spec?.phase ?? 0]?.id ?? "";

    await Promise.all(
      Array.from({ length: lessons.count }, async (_, index) => {
        const lesson = await libraryLessonFixture({
          estimatedMinutes: lessons.minutes,
          homeChapterId: chapterId,
          title: `Outlined ${skill}.${index} ${crypto.randomUUID()}`,
        });

        await Promise.all([
          chapterLessonFixture({ chapterId, lessonId: lesson.id, position: 500 + index }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: spec?.skillId ?? "" }),
        ]);
      }),
    );
  };

  return { goal, library, outline, plan };
}

async function readPhaseEnds(planId: string): Promise<(string | null)[]> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const phases = plan.phases as { endDate: string | null }[];

  return phases.map((phase) => phase.endDate);
}

async function readChallengeDates(planId: string): Promise<(string | undefined)[]> {
  const bosses = await prisma.planItem.findMany({
    orderBy: { phase: "asc" },
    where: { kind: "boss", planId },
  });

  return bosses.map((boss) => boss.scheduledFor?.toISOString().slice(0, 10));
}

async function readLastLessonDay({
  phase,
  planId,
  skills,
}: {
  phase: number;
  planId: string;
  skills: readonly { phase: number; skillId: string }[];
}): Promise<string | undefined> {
  const lesson = await prisma.planItem.findFirst({
    orderBy: { scheduledFor: "desc" },
    where: {
      kind: "lesson",
      planId,
      skillId: { in: skills.flatMap((skill) => (skill.phase === phase ? [skill.skillId] : [])) },
      status: "todo",
    },
  });

  return lesson?.scheduledFor?.toISOString().slice(0, 10);
}

function readProposals(planId: string) {
  return prisma.planChange.findMany({ where: { planId, status: "proposed" } });
}

async function landShorterThenLonger(outline: Awaited<ReturnType<typeof setup>>["outline"]) {
  await outline({ outline: { count: 10, minutes: 1 }, skill: 1 });
  await outline({ outline: { count: 5, minutes: 8 }, skill: 3 });
}

const RESTING_PHASES = ["Basics", "Projects", "Review"];

async function setupRestingEnd({
  lessons = 6,
  spareMinutes = 12,
}: { lessons?: number; spareMinutes?: number } = {}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: RESTING_PHASES,
    skills: [
      { lessons, phase: 0 },
      { lessons, phase: 1 },
      { lessons, phase: 2 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-27" },
    targetDate: FAR,
    timezone: "UTC",
    userId: user.id,
  });

  await takenChallengeFixture({ date: LAST_WEEK, planId: plan.id });
  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const ends = await readPhaseEnds(plan.id);
  const restDay = new Date(`${ends[0]}T00:00:00Z`).getUTCDay();
  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

  await prisma.plan.update({
    data: {
      settings: {
        ...(saved.settings as Record<string, unknown>),
        weekdayMinutes: Array.from({ length: 7 }, (_, day) => {
          if (day === restDay) {
            return 0;
          }

          return day === (restDay + 2) % 7 ? spareMinutes : 12;
        }),
      },
    },
    where: { id: plan.id },
  });

  return { ends, goal, plan, restDay };
}

function getDayAfter(date: string): string {
  return toIsoDate(addDays(fromIsoDate(date), 1));
}

async function readProposedMoves(planId: string) {
  const [proposal] = await readProposals(planId);

  const payload = proposal?.payload as
    | {
        effect: {
          phaseEnds: {
            after: string;
            before: string;
            lessonsFirst?: true;
            name: string;
            restDay?: true;
          }[];
        };
      }
    | undefined;

  return { moves: payload?.effect.phaseEnds ?? [], proposal };
}

async function expectChallengeDate({ date, planId }: { date: string; planId: string }) {
  const boss = await prisma.planItem.findFirstOrThrow({
    where: { kind: "boss", phase: 0, planId },
  });

  expect(boss.scheduledFor).toStrictEqual(new Date(date));

  await expect(
    getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
  ).resolves.toMatchObject({
    challenge: { date, planItemId: boss.id, status: "upcoming" },
    status: "ready",
  });
}

describe("phase dates through system refreshes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers to move a phase's end past lessons that land longer than planned, so its challenge comes after them", async () => {
    const { goal, library, outline, plan } = await setup({ targetDate: FAR });
    const ends = await readPhaseEnds(plan.id);

    await outline({ outline: { count: 10, minutes: 8 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });

    const [[kept], outlined] = await Promise.all([
      readChallengeDates(plan.id),
      prisma.planItem.count({
        where: { lessonId: { not: null }, planId: plan.id, status: "todo" },
      }),
    ]);

    expect(ends[0]).not.toBeNull();
    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);
    expect(kept).toBe(ends[0]);
    expect(outlined).toBeGreaterThanOrEqual(20);

    const { moves, proposal } = await readProposedMoves(plan.id);

    expect(moves).toStrictEqual([
      { after: expect.any(String), before: ends[0], lessonsFirst: true, name: "Basics" },
    ]);

    await decidePlanChange({
      changeId: proposal?.id ?? "",
      goalId: goal.id,
      input: { status: "applied", timeZone: "UTC" },
    });

    const [end] = await readPhaseEnds(plan.id);
    const [challenge] = await readChallengeDates(plan.id);

    const last = await readLastLessonDay({
      phase: 0,
      planId: plan.id,
      skills: library.graph.skills,
    });

    expect(end).toBe(moves[0]?.after);
    expect(challenge).toBe(end);
    expect(last && end && last <= end).toBe(true);
  });

  it("keeps a new learner's challenge after lessons that land longer than planned, without asking", async () => {
    const { goal, library, outline, plan } = await setup({
      challengeTaken: false,
      targetDate: FAR,
    });

    const [planned] = await readPhaseEnds(plan.id);

    await outline({ outline: { count: 10, minutes: 8 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });

    const [[end], [challenge], last] = await Promise.all([
      readPhaseEnds(plan.id),
      readChallengeDates(plan.id),
      readLastLessonDay({ phase: 0, planId: plan.id, skills: library.graph.skills }),
    ]);

    expect(end && planned && end > planned).toBe(true);
    expect(challenge).toBe(end);
    expect(last && end && last < end).toBe(true);
    await expect(readProposals(plan.id)).resolves.toHaveLength(0);

    await expect(getTodayView({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      status: "ready",
      today: { planChange: null },
    });
  });

  it("moves an unsafe phase end after a focus and names the applied move", async () => {
    const { goal, library, outline, plan } = await setup({ targetDate: FAR });
    const ends = await readPhaseEnds(plan.id);
    expect(ends[0]).toBe("2020-10-06");

    await outline({ outline: { count: 10, minutes: 8 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });

    const before = await readProposedMoves(plan.id);

    const changed = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ areas: ["Projects"], kind: "reduceAreas" }], timeZone: "UTC" },
    });

    expect(before.moves).toHaveLength(1);

    if (changed.status !== "applied" || !changed.change) {
      throw new Error("Expected the actual focus change");
    }

    const phaseEnds = [
      { after: "2020-10-14", before: "2020-10-06", lessonsFirst: true, name: "Basics" },
    ];

    expect(changed.change.effect?.phaseEnds).toStrictEqual(phaseEnds);
    const applied = await prisma.planChange.findUniqueOrThrow({ where: { id: changed.change.id } });
    expect(applied).toMatchObject({ kind: "edited", status: "applied" });
    const payload = parsePlanChangePayload(applied.payload);
    expect(payload.source).toBe("learner");
    expect(payload.effect?.phaseEnds).toStrictEqual(phaseEnds);
    await expect(readProposals(plan.id)).resolves.toHaveLength(0);

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: before.proposal?.id ?? "" } }),
    ).resolves.toMatchObject({ status: "replaced" });

    const [end] = await readPhaseEnds(plan.id);
    expect(end).toBe("2020-10-14");

    await expect(
      readLastLessonDay({ phase: 0, planId: plan.id, skills: library.graph.skills }),
    ).resolves.toBe("2020-10-13");

    await expect(
      prisma.planItem.count({
        where: {
          kind: "lesson",
          planId: plan.id,
          skillId: { in: library.skills.slice(0, 2).map((skill) => skill.id) },
        },
      }),
    ).resolves.toBe(14);

    await expectChallengeDate({ date: "2020-10-14", planId: plan.id });
  });

  it("offers to move a phase's end this week past lessons that land longer than planned", async () => {
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));

    const { goal, library, outline, plan } = await setup({
      skills: [
        { lessons: 2, phase: 0 },
        { lessons: 0, phase: 0, size: 3 },
        { lessons: 6, phase: 1 },
        { lessons: 0, phase: 1, size: 5 },
      ],
      targetDate: FAR,
    });

    const ends = await readPhaseEnds(plan.id);

    expect(ends[0] && ends[0] <= "2020-10-04").toBe(true);

    await outline({ outline: { count: 3, minutes: 12 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });

    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);

    const { moves, proposal } = await readProposedMoves(plan.id);

    expect(moves).toStrictEqual([
      { after: expect.any(String), before: ends[0], lessonsFirst: true, name: "Basics" },
    ]);

    await decidePlanChange({
      changeId: proposal?.id ?? "",
      goalId: goal.id,
      input: { status: "applied", timeZone: "UTC" },
    });

    const [end] = await readPhaseEnds(plan.id);
    const [challenge] = await readChallengeDates(plan.id);

    const last = await readLastLessonDay({
      phase: 0,
      planId: plan.id,
      skills: library.graph.skills,
    });

    expect(end).toBe(moves[0]?.after);
    expect(challenge).toBe(end);
    expect(last && end && last <= end).toBe(true);
  });

  it("keeps a new learner's challenge this week after lessons that land longer than planned, without asking", async () => {
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));

    const { goal, library, outline, plan } = await setup({
      challengeTaken: false,
      skills: [
        { lessons: 2, phase: 0 },
        { lessons: 0, phase: 0, size: 3 },
        { lessons: 6, phase: 1 },
        { lessons: 0, phase: 1, size: 5 },
      ],
      targetDate: FAR,
    });

    const [planned] = await readPhaseEnds(plan.id);

    expect(planned && planned <= "2020-10-04").toBe(true);

    await outline({ outline: { count: 3, minutes: 12 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });

    const [[end], [challenge], last] = await Promise.all([
      readPhaseEnds(plan.id),
      readChallengeDates(plan.id),
      readLastLessonDay({ phase: 0, planId: plan.id, skills: library.graph.skills }),
    ]);

    expect(challenge).toBe(end);
    expect(last && end && last <= end).toBe(true);
    await expect(readProposals(plan.id)).resolves.toHaveLength(0);
  });

  it("keeps the rest of a stand-in whose first lesson landed in its time this week", async () => {
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));

    const { goal, library, outline, plan } = await setup({
      skills: [
        { lessons: 0, phase: 0, size: 6 },
        { lessons: 2, phase: 0 },
        { lessons: 6, phase: 1 },
        { lessons: 0, phase: 1, size: 5 },
      ],
      targetDate: FAR,
    });

    const ends = await readPhaseEnds(plan.id);

    await outline({ outline: { count: 1, minutes: 4 }, skill: 0 });
    await refreshGoalPlan({ goalId: goal.id });

    const [challenge] = await readChallengeDates(plan.id);

    const last = await readLastLessonDay({
      phase: 0,
      planId: plan.id,
      skills: library.graph.skills,
    });

    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);
    expect(challenge).toBe(ends[0]);
    expect(last && challenge && last <= challenge).toBe(true);
  });

  it("keeps the first phase's end when its lessons land shorter than planned", async () => {
    const { goal, outline, plan } = await setup({ targetDate: FAR });
    const [firstEnd] = await readPhaseEnds(plan.id);

    await outline({ outline: { count: 10, minutes: 1 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });

    const [endAfter] = await readPhaseEnds(plan.id);
    const [challenge] = await readChallengeDates(plan.id);

    expect(endAfter).toBe(firstEnd);
    expect(challenge).toBe(firstEnd);
    await expect(readProposals(plan.id)).resolves.toHaveLength(0);
  });

  it("proposes moving the dates when keeping them leaves lessons out by the goal's date, and keeps them until the learner says so", async () => {
    const { goal, outline, plan } = await setup({ targetDate: TIGHT });
    const ends = await readPhaseEnds(plan.id);

    await landShorterThenLonger(outline);
    await refreshGoalPlan({ goalId: goal.id });

    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);

    const [proposal, ...others] = await readProposals(plan.id);

    expect(others).toHaveLength(0);

    expect(proposal?.payload).toMatchObject({
      effect: { phaseEnds: [{ before: ends[0], name: "Basics" }] },
      operations: [{ kind: "fitPhaseDates" }],
      source: "phaseDates",
    });

    const payload = proposal?.payload as
      | { effect: { lessonsAdded: number; phaseEnds: { after: string }[] } }
      | undefined;

    const moved = payload?.effect.phaseEnds[0]?.after;

    expect(payload?.effect.lessonsAdded).toBeGreaterThan(0);
    expect(moved && ends[0] && moved < ends[0]).toBe(true);

    await refreshGoalPlan({ goalId: goal.id });
    await expect(readProposals(plan.id)).resolves.toHaveLength(1);

    await decidePlanChange({
      changeId: proposal?.id ?? "",
      goalId: goal.id,
      input: { status: "declined", timeZone: "UTC" },
    });

    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });

    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);
    await expect(readProposals(plan.id)).resolves.toHaveLength(0);
  });

  it("moves an unsafe phase end after a rest day and records it, quietly on Today", async () => {
    const { goal, plan } = await setup({ targetDate: FAR });
    const ends = await readPhaseEnds(plan.id);
    expect(ends[0]).toBe("2020-10-06");
    const restDay = new Date(`${ends[0]}T00:00:00Z`).getUTCDay();
    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const settings = saved.settings as Record<string, unknown>;

    await prisma.plan.update({
      data: {
        settings: {
          ...settings,
          weekdayMinutes: Array.from({ length: 7 }, (_, day) => (day === restDay ? 0 : 12)),
        },
      },
      where: { id: plan.id },
    });

    await refreshGoalPlan({ goalId: goal.id });

    const [endAfter] = await readPhaseEnds(plan.id);
    const [challenge] = await readChallengeDates(plan.id);

    expect(endAfter).toBe("2020-10-08");
    expect(challenge).toBe("2020-10-08");
    await expect(readProposals(plan.id)).resolves.toHaveLength(0);

    const applied = await prisma.planChange.findFirstOrThrow({
      where: { kind: "estimateUpdated", planId: plan.id, status: "applied" },
    });

    const phaseEnds = [
      { after: "2020-10-08", before: "2020-10-06", lessonsFirst: true, name: "Basics" },
    ];

    const payload = parsePlanChangePayload(applied.payload);
    expect(payload.source).toBe("system");
    expect(payload.effect).toMatchObject({ lessonsAdded: 0, lessonsRemoved: 0 });
    expect(payload.effect?.phaseEnds).toStrictEqual(phaseEnds);
    await expectChallengeDate({ date: "2020-10-08", planId: plan.id });

    await expect(getTodayView({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      status: "ready",
      today: { planChange: null },
    });
  });

  it("proposes moving only the end a rest day holds, keeping the others the learner saw", async () => {
    const { ends, goal, plan } = await setupRestingEnd({ spareMinutes: 24 });

    await refreshGoalPlan({ goalId: goal.id });

    const after = await readPhaseEnds(plan.id);

    expect(after.slice(0, -1)).toStrictEqual(ends.slice(0, -1));
    await expect(readChallengeDates(plan.id)).resolves.toContain(ends[0]);

    const { moves } = await readProposedMoves(plan.id);

    expect(moves).toStrictEqual([
      { after: getDayAfter(ends[0] ?? ""), before: ends[0], name: "Basics", restDay: true },
    ]);
  });

  it("moves a later end only as far as its lessons need when the moved challenge takes their day", async () => {
    const { ends, goal, plan } = await setupRestingEnd({ lessons: 4 });

    await refreshGoalPlan({ goalId: goal.id });

    const { moves } = await readProposedMoves(plan.id);

    expect(moves).toStrictEqual([
      { after: getDayAfter(ends[0] ?? ""), before: ends[0], name: "Basics", restDay: true },
      { after: getDayAfter(ends[1] ?? ""), before: ends[1], name: "Projects" },
    ]);
  });

  it("moves only the ends the proposal named, to the days it said, when the learner applies it", async () => {
    vi.setSystemTime(new Date("2020-09-30T12:00:00Z"));

    const { ends, goal, plan } = await setupRestingEnd({ lessons: 8 });

    await refreshGoalPlan({ goalId: goal.id });

    const { moves, proposal } = await readProposedMoves(plan.id);

    expect(moves.length).toBeGreaterThan(0);

    await decidePlanChange({
      changeId: proposal?.id ?? "",
      goalId: goal.id,
      input: { status: "applied", timeZone: "UTC" },
    });

    const expected = ends.map(
      (end, index) => moves.find((move) => move.name === RESTING_PHASES[index])?.after ?? end,
    );

    const after = await readPhaseEnds(plan.id);

    expect(after.slice(0, -1)).toStrictEqual(expected.slice(0, -1));
  });

  it("withdraws a waiting proposal once the learner changes their plan, which it no longer describes", async () => {
    const { goal, outline, plan } = await setup({ targetDate: TIGHT });

    await landShorterThenLonger(outline);
    await refreshGoalPlan({ goalId: goal.id });

    const [proposal] = await readProposals(plan.id);

    expect(proposal).toBeDefined();

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setTargetDate", targetDate: null }], timeZone: "UTC" },
    });

    await expect(readProposals(plan.id)).resolves.toHaveLength(0);

    await expect(
      prisma.planChange.findUnique({ where: { id: proposal?.id ?? "" } }),
    ).resolves.toMatchObject({ status: "replaced" });
  });

  it("moves the dates when the learner applies the proposal, and everything fits by the goal's date", async () => {
    const { goal, outline, plan } = await setup({ targetDate: TIGHT });
    const [firstEnd] = await readPhaseEnds(plan.id);

    await landShorterThenLonger(outline);
    await refreshGoalPlan({ goalId: goal.id });

    const [proposal] = await readProposals(plan.id);

    await decidePlanChange({
      changeId: proposal?.id ?? "",
      goalId: goal.id,
      input: { status: "applied", timeZone: "UTC" },
    });

    const [endAfter] = await readPhaseEnds(plan.id);

    const applied = await prisma.planChange.findMany({
      orderBy: { createdAt: "desc" },
      where: { planId: plan.id, status: "applied" },
    });

    const quoted = parsePlanChangePayload(proposal?.payload).effect;
    const recorded = parsePlanChangePayload(applied[0]?.payload).effect;

    expect(recorded?.lessonsAdded).toBe(quoted?.lessonsAdded);
    expect(recorded?.lessonsRemoved).toBe(quoted?.lessonsRemoved);

    const lessonsLeftOut = await prisma.planItem.count({
      where: { kind: "lesson", planId: plan.id, scheduledFor: null, status: "todo" },
    });

    expect(endAfter).not.toBe(firstEnd);
    expect(endAfter && firstEnd && endAfter < firstEnd).toBe(true);
    expect(lessonsLeftOut).toBe(0);
  });

  it("keeps the dates when earlier days left lessons that still fit before them, which come first", async () => {
    const { goal, outline, plan } = await setup({ targetDate: FAR });
    const ends = await readPhaseEnds(plan.id);

    await outline({ outline: { count: 10, minutes: 1 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });
    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);

    vi.setSystemTime(new Date("2020-09-29T12:00:00Z"));
    await refreshGoalPlan({ goalId: goal.id });

    const settled = await prisma.planChange.findFirst({
      where: { kind: "missedDays", planId: plan.id },
    });

    const first = await prisma.planItem.findFirst({
      orderBy: { position: "asc" },
      where: { kind: "lesson", planId: plan.id, status: "todo" },
    });

    expect(settled).not.toBeNull();
    expect(first?.scheduledFor?.toISOString().slice(0, 10)).toBe("2020-09-29");
    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);
    await expect(readChallengeDates(plan.id)).resolves.toContain(ends[0]);
  });

  it("moves a phase's end past the lessons missed days leave, and says so", async () => {
    const { goal, library, outline, plan } = await setup({ targetDate: FAR });
    const ends = await readPhaseEnds(plan.id);

    await outline({ outline: { count: 10, minutes: 8 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });
    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);

    vi.setSystemTime(new Date("2020-10-01T12:00:00Z"));
    await refreshGoalPlan({ goalId: goal.id });

    const [end, last] = await readPhaseEnds(plan.id);
    const [challenge] = await readChallengeDates(plan.id);

    const lessons = await prisma.planItem.findMany({
      orderBy: { scheduledFor: "asc" },
      where: {
        kind: "lesson",
        planId: plan.id,
        skillId: {
          in: library.graph.skills.flatMap((skill) => (skill.phase === 0 ? [skill.skillId] : [])),
        },
        status: "todo",
      },
    });

    const settled = await prisma.planChange.findFirst({
      where: { kind: "missedDays", planId: plan.id },
    });

    expect(lessons[0]?.scheduledFor?.toISOString().slice(0, 10)).toBe("2020-10-01");
    expect(end && ends[0] && end > ends[0]).toBe(true);
    expect(challenge).toBe(end);

    expect(lessons.at(-1)?.scheduledFor?.toISOString().slice(0, 10) ?? "").toSatisfy(
      (day: string) => Boolean(end && day <= end),
    );

    expect(last).toBe(ends[1]);

    expect(settled?.payload).toMatchObject({
      effect: { phaseEnds: [{ after: end, before: ends[0], name: "Basics" }] },
    });

    await expect(readProposals(plan.id)).resolves.toHaveLength(0);
  });

  it("still moves the dates when the learner changes their plan", async () => {
    const { goal, outline, plan } = await setup({ targetDate: FAR });
    const [firstEnd] = await readPhaseEnds(plan.id);

    await outline({ outline: { count: 10, minutes: 8 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 24 }], timeZone: "UTC" },
    });

    const [endAfter] = await readPhaseEnds(plan.id);

    expect(endAfter).not.toBe(firstEnd);
    expect(endAfter && firstEnd && endAfter < firstEnd).toBe(true);
  });
});
