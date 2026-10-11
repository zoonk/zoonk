import { prisma } from "@zoonk/db";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { addDays, fromIsoDate, toIsoDate } from "./planner/plan-calendar";
import { refreshGoalPlan } from "./refresh-goal-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/**
 * A Sunday in 2020, before the learning events other tests write (estimates read everyone's recent
 * pace): this week is only today, so a refresh lays out everything from tomorrow on.
 */
const SUNDAY = new Date("2020-09-27T12:00:00Z");

const FAR = new Date("2020-12-31T00:00:00Z");

/** Just enough days for the plan as it was first estimated: its final challenge is on Oct 16. */
const TIGHT = new Date("2020-10-17T00:00:00Z");

type Outline = { count: number; minutes: number };

const SKILLS = [
  { lessons: 4, phase: 0 },
  { lessons: 0, phase: 0, size: 10 },
  { lessons: 6, phase: 1 },
  { lessons: 0, phase: 1, size: 5 },
];

/**
 * A learn goal of two phases whose first phase ends days ahead: written lessons and a skill the
 * Library hasn't outlined yet (a stand-in of 10 four-minute lessons) in the first, written lessons
 * and a stand-in of 5 in the second. 12 minutes a day give lessons 6 of them. `skills` sizes
 * them otherwise, in the same order.
 */
async function setup({
  skills = SKILLS,
  targetDate,
}: {
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

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  /** The Library outlines a stand-in's skill as `count` lessons of `minutes` each. */
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

/** The end dates the plan shows for its phases, as saved. */
async function readPhaseEnds(planId: string): Promise<(string | null)[]> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const phases = plan.phases as { endDate: string | null }[];

  return phases.map((phase) => phase.endDate);
}

/** The day each phase's challenge is due. */
async function readChallengeDates(planId: string): Promise<(string | undefined)[]> {
  const bosses = await prisma.planItem.findMany({
    orderBy: { phase: "asc" },
    where: { kind: "boss", planId },
  });

  return bosses.map((boss) => boss.scheduledFor?.toISOString().slice(0, 10));
}

/** The day of the last lesson still to do of a graph phase's skills. */
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

/** The first phase lands 30 minutes shorter and the second 20 minutes longer than estimated. */
async function landShorterThenLonger(outline: Awaited<ReturnType<typeof setup>>["outline"]) {
  await outline({ outline: { count: 10, minutes: 1 }, skill: 1 });
  await outline({ outline: { count: 5, minutes: 8 }, skill: 3 });
}

const RESTING_PHASES = ["Basics", "Projects", "Review"];

/**
 * A learn goal of three phases of six written lessons each whose first phase ends on a day the
 * learner then gives no time (set in the settings alone here: the learner's own change of rest
 * days plans the dates again), with the ends it showed before. `spareMinutes`: the time they give
 * the second day after it, which leaves the second phase time to spare.
 */
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

/** The phase ends a waiting proposal moves, as it says them. */
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

/*
 * The plan's phase dates are what the learner saw on the plan's reveal and then on Journey. Lessons
 * the Library writes later take a little more or less time than the plan estimated; a system
 * refresh puts them in the plan without moving those dates, and absorbs the difference inside the
 * phase. Pass 8: Marcos's reveal said his first phase ends Oct 23 and Journey, minutes later, Oct 22.
 */
describe("phase dates through system refreshes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the first phase's end when its lessons land longer than planned", async () => {
    const { goal, outline, plan } = await setup({ targetDate: FAR });
    const [firstEnd] = await readPhaseEnds(plan.id);

    // Ten 8-minute lessons, not ten of 4: the phase's lessons take 40 minutes more.
    await outline({ outline: { count: 10, minutes: 8 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });

    const [endAfter] = await readPhaseEnds(plan.id);
    const [challenge] = await readChallengeDates(plan.id);

    expect(firstEnd).not.toBeNull();
    expect(endAfter).toBe(firstEnd);
    expect(challenge).toBe(firstEnd);

    // The outlined lessons are in the plan.
    const outlined = await prisma.planItem.count({
      where: { lessonId: { not: null }, planId: plan.id, status: "todo" },
    });

    expect(outlined).toBeGreaterThanOrEqual(20);
  });

  // Lessons that come out longer than planned would come after the challenge on the end the
  // learner saw, which tests them (R40). The end stays until the learner says so (R6), and Today
  // offers to move it to right after those lessons, saying why (IELTS seed 1011, lead 10 Oct).
  it("offers to move a phase's end past lessons that land longer than planned, so its challenge comes after them", async () => {
    const { goal, library, outline, plan } = await setup({ targetDate: FAR });
    const ends = await readPhaseEnds(plan.id);

    await outline({ outline: { count: 10, minutes: 8 }, skill: 1 });
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

  // A change of focus keeps the phase ends the learner sees, so the challenge still came before the
  // lessons it tests, and the change took Today's card offering to move its end with it (career
  // 1230, 2107): Today asks again right away.
  it("asks again to move a phase's end after a change of focus that keeps it before its lessons", async () => {
    const { goal, outline, plan } = await setup({ targetDate: FAR });
    const ends = await readPhaseEnds(plan.id);

    await outline({ outline: { count: 10, minutes: 8 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });

    const before = await readProposedMoves(plan.id);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ areas: ["Projects"], kind: "reduceAreas" }], timeZone: "UTC" },
    });

    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);

    const { moves, proposal } = await readProposedMoves(plan.id);

    expect(before.moves).toHaveLength(1);
    expect(proposal?.id).not.toBe(before.proposal?.id);

    expect(moves).toStrictEqual([
      { after: expect.any(String), before: ends[0], lessonsFirst: true, name: "Basics" },
    ]);
  });

  // The same with a first phase that ends this week: a system refresh keeps this week as the
  // learner saw it, its challenge too, but moving its end lets it go after its lessons. Kept with
  // the week, it stayed before them (language seed 1, 10-18).
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

    // Three 12-minute lessons, not three of 4.
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

  // The Library outlines a stand-in's first lesson only: the rest of its skill, still a stand-in,
  // keeps the stand-in's time this week, before its phase's challenge. Taken as new work, it went
  // after this week, after the challenge that tests it, and moving the end gave nothing to propose
  // (language seed 1006, a day-one landing).
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

    // Ten 1-minute lessons, not ten of 4: the phase's lessons take 30 minutes less.
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

    // Moving the first phase's end earlier fits everything; keeping it leaves the second phase's
    // last lessons out.
    await landShorterThenLonger(outline);
    await refreshGoalPlan({ goalId: goal.id });

    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);

    const [proposal, ...others] = await readProposals(plan.id);

    expect(others).toHaveLength(0);

    // It says what moves: the first phase would end sooner, and the lessons it fits in.
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

    // Another refresh with nothing new asks nothing new.
    await refreshGoalPlan({ goalId: goal.id });
    await expect(readProposals(plan.id)).resolves.toHaveLength(1);

    // Keeping their version: the dates stay, and the next refresh doesn't ask again.
    await decidePlanChange({
      changeId: proposal?.id ?? "",
      goalId: goal.id,
      input: { status: "declined", timeZone: "UTC" },
    });

    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });

    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);
    await expect(readProposals(plan.id)).resolves.toHaveLength(0);
  });

  // A shown end never moves without the learner (R6). The day the first phase ends turns into one
  // the learner gives no time (set in the settings alone here: the learner's own change of rest
  // days plans the dates again): the challenge stays on it, and Today offers to move the dates.
  it("keeps a phase's end on a day with no study time and proposes moving the dates", async () => {
    const { goal, plan } = await setup({ targetDate: FAR });
    const ends = await readPhaseEnds(plan.id);
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

    // The last phase ends with the plan, on its last lesson, which the day the learner rests moves.
    const [endAfter] = await readPhaseEnds(plan.id);
    const [challenge] = await readChallengeDates(plan.id);

    expect(endAfter).toBe(ends[0]);
    expect(challenge).toBe(ends[0]);

    const [proposal, ...others] = await readProposals(plan.id);

    expect(others).toHaveLength(0);

    expect(proposal?.payload).toMatchObject({
      effect: { lessonsAdded: 0, phaseEnds: [{ before: ends[0], name: "Basics", restDay: true }] },
      operations: [{ kind: "fitPhaseDates" }],
      source: "phaseDates",
    });
  });

  // The proposal moves only the end that can't hold its challenge, to the next day the learner
  // studies: the other ends the learner saw stay (lead, 10 Oct). Planned again from scratch, every
  // end moved a day as a side effect. The second phase has time to spare for the day its lessons
  // give the moved challenge.
  it("proposes moving only the end a rest day holds, keeping the others the learner saw", async () => {
    const { ends, goal, plan } = await setupRestingEnd({ spareMinutes: 24 });

    await refreshGoalPlan({ goalId: goal.id });

    // The ends stay while the proposal waits; the last phase ends with the plan, on its last lesson.
    const after = await readPhaseEnds(plan.id);

    expect(after.slice(0, -1)).toStrictEqual(ends.slice(0, -1));
    await expect(readChallengeDates(plan.id)).resolves.toContain(ends[0]);

    const { moves } = await readProposedMoves(plan.id);

    expect(moves).toStrictEqual([
      { after: getDayAfter(ends[0] ?? ""), before: ends[0], name: "Basics", restDay: true },
    ]);
  });

  // Moved to the next day the learner studies, the challenge takes that day's lesson time, and a
  // plan with no time to spare then has the next phase's lessons a day later: that phase's end
  // moves with them, a day, so its challenge still comes after them (R40). Kept, the move put the
  // next challenge before two of its own lessons.
  it("moves a later end only as far as its lessons need when the moved challenge takes their day", async () => {
    const { ends, goal, plan } = await setupRestingEnd();

    await refreshGoalPlan({ goalId: goal.id });

    const { moves } = await readProposedMoves(plan.id);

    expect(moves).toStrictEqual([
      { after: getDayAfter(ends[0] ?? ""), before: ends[0], name: "Basics", restDay: true },
      { after: getDayAfter(ends[1] ?? ""), before: ends[1], name: "Projects" },
    ]);
  });

  // Applying it does what it said: the ends it named move to the days it said, and every other end
  // the learner saw stays (lead, 10 Oct). Applied as a re-plan from scratch, the other ends moved a
  // day too. A Wednesday, with days of this week left.
  it("moves only the ends the proposal named, to the days it said, when the learner applies it", async () => {
    vi.setSystemTime(new Date("2020-09-30T12:00:00Z"));

    const { ends, goal, plan } = await setupRestingEnd({ lessons: 12 });

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

    // The last phase ends with the plan, on its last lesson.
    expect(after.slice(0, -1)).toStrictEqual(expected.slice(0, -1));
  });

  it("withdraws a waiting proposal once the learner changes their plan, which it no longer describes", async () => {
    const { goal, outline, plan } = await setup({ targetDate: TIGHT });

    await landShorterThenLonger(outline);
    await refreshGoalPlan({ goalId: goal.id });

    const [proposal] = await readProposals(plan.id);

    expect(proposal).toBeDefined();

    // Walk: Maya removed her deadline and Today still offered to move the old dates.
    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setTargetDate", targetDate: null }], timeZone: "UTC" },
    });

    await expect(readProposals(plan.id)).resolves.toHaveLength(0);

    await expect(
      prisma.planChange.findUnique({ where: { id: proposal?.id ?? "" } }),
    ).resolves.toMatchObject({ status: "replaced" });
  });

  // A proposal an earlier version of the planner made stays while nothing the plan reads changes:
  // the refresh that finds the plan as it was skipped the proposal too, and an on-track learner
  // kept seeing "some lessons came out longer than planned" (walk, Lucas).
  it("withdraws a waiting proposal the plan no longer needs, though nothing changed since", async () => {
    const { goal, plan } = await setup({ targetDate: FAR });

    await refreshGoalPlan({ goalId: goal.id });

    const stale = await prisma.planChange.create({
      data: {
        kind: "edited",
        payload: {
          effect: {
            phaseEnds: [
              { after: "2020-10-10", before: "2020-10-09", lessonsFirst: true, name: "Basics" },
            ],
          },
          operations: [{ kind: "fitPhaseDates" }],
          source: "phaseDates",
        },
        planId: plan.id,
        reason: "",
        status: "proposed",
      },
    });

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toMatchObject({
      status: "unchanged",
    });

    await expect(prisma.planChange.findUnique({ where: { id: stale.id } })).resolves.toMatchObject({
      status: "replaced",
    });
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

    // The first phase's lessons take 30 minutes less than planned: its last days get lighter.
    await outline({ outline: { count: 10, minutes: 1 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });
    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);

    // Two days later, nothing studied: what those days had comes first today.
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

  // A missed day may move a phase's end (R6): kept, the challenge would come before the lessons
  // the days left, which it tests (R40). The end moves to right after them, and the missed-days
  // change names the move (lead, option A for career seed 1027).
  it("moves a phase's end past the lessons missed days leave, and says so", async () => {
    const { goal, library, outline, plan } = await setup({ targetDate: FAR });
    const ends = await readPhaseEnds(plan.id);

    await outline({ outline: { count: 10, minutes: 8 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });
    await expect(readPhaseEnds(plan.id)).resolves.toStrictEqual(ends);

    // Four days later, nothing studied: what those days had comes first today.
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

    // The proposal to move that end no longer describes the plan.
    await expect(readProposals(plan.id)).resolves.toHaveLength(0);
  });

  it("still moves the dates when the learner changes their plan", async () => {
    const { goal, outline, plan } = await setup({ targetDate: FAR });
    const [firstEnd] = await readPhaseEnds(plan.id);

    await outline({ outline: { count: 10, minutes: 8 }, skill: 1 });
    await refreshGoalPlan({ goalId: goal.id });

    // Twice the time a day: the first phase ends sooner.
    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 24 }], timeZone: "UTC" },
    });

    const [endAfter] = await readPhaseEnds(plan.id);

    expect(endAfter).not.toBe(firstEnd);
    expect(endAfter && firstEnd && endAfter < firstEnd).toBe(true);
  });
});
