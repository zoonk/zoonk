import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { type LearnerPlanOperation } from "./plan-contract";
import { parsePlanGraph } from "./planner/plan-state";
import { proposePlanChange } from "./propose-plan-change";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** A Monday in 2020, before the learning events other tests write, so nobody's pace moves it. */
const NOW = new Date("2020-09-28T12:00:00Z");

const AREAS = ["Matemática", "Direito", "Inglês"] as const;

const citation = { passage: "Conteúdo programático", sourceId: "notice" };

/** Each area's basics in the first phase and what builds on them in the next, a topic each. */
const SKILLS = AREAS.flatMap((area) => [
  { area, lessons: 6, phase: 0, topic: `${area}: fundamentos` },
  { area, lessons: 6, phase: 1, topic: `${area}: aplicação` },
]);

/** The topic an earlier run of the plan left out, which the learner sees out of it. */
const LEFT_OUT = "Inglês: aplicação";

/**
 * An exam learner three weeks before the exam, with a notice topic per skill, the plan's
 * `settings` (where they focus) and each Library lesson's minutes taken from `lessonMinutes` in
 * turn.
 */
async function setup({
  dailyMinutes,
  lessonMinutes = [6],
  mockMinutes = null,
  settings = {},
  skills = SKILLS,
}: {
  dailyMinutes: number;
  lessonMinutes?: number[];
  mockMinutes?: number | null;
  settings?: object;
  skills?: typeof SKILLS;
}) {
  const user = await userFixture();

  const blueprint = await examBlueprintFixture({
    structure: examStructureSchema.parse({
      formats: [],
      mock:
        mockMinutes === null
          ? null
          : {
              citations: [citation],
              order: null,
              scoring: { description: "Correct answers", method: "raw" },
              sections: [],
              timeLimitMinutes: mockMinutes,
              totalQuestions: 30,
            },
      rules: [],
      subjects: AREAS.map((area) => ({
        citation,
        name: area,
        questions: 10,
        topics: skills.filter((skill) => skill.area === area).map((skill) => skill.topic),
        weight: null,
      })),
    }),
  });

  const library = await planLibraryFixture({ phases: ["Basics", "Further"], skills });

  await Promise.all(
    lessonMinutes.map((estimatedMinutes, turn) =>
      prisma.lesson.updateMany({
        data: { estimatedMinutes },
        where: {
          id: {
            in: library.lessons
              .filter((_, index) => index % lessonMinutes.length === turn)
              .map((lesson) => lesson.id),
          },
        },
      }),
    ),
  );

  const graph = {
    ...library.graph,
    skills: library.graph.skills.map((skill, index) => ({
      ...skill,
      topics: [skills[index]?.topic ?? ""],
    })),
  };

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-28", ...settings },
    targetDate: new Date("2020-10-19T00:00:00Z"),
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph });
  mockSession(user.id);

  const leftOutSkill = library.skills[skills.findIndex((skill) => skill.topic === LEFT_OUT)];

  return { goal, leftOutSkill, plan };
}

/**
 * The plan as the learner sees it, saved by an earlier run that left a topic out (an automatic
 * run that kept the week, a pace or lessons that moved what fits): planning it again from today
 * brings that topic back.
 */
async function leaveOut({ planId, skillId }: { planId: string; skillId: string }) {
  await prisma.planItem.deleteMany({ where: { planId, skillId, status: "todo" } });
}

async function change(goalId: string, operations: LearnerPlanOperation[]) {
  const result = await changeGoalPlan({ goalId, input: { operations } });
  return result.status === "applied" ? result.change : null;
}

function listTopics(areas: { topics: string[] }[] | undefined): string[] {
  return (areas ?? []).flatMap((area) => area.topics);
}

describe("a change's card says what changes in the plan the learner sees", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never says a topic leaves the plan when the learner already sees it out", async () => {
    const { goal, leftOutSkill, plan } = await setup({ dailyMinutes: 30 });
    await leaveOut({ planId: plan.id, skillId: leftOutSkill?.id ?? "" });

    const changed = await change(goal.id, [{ kind: "setDailyMinutes", minutes: 8 }]);

    expect(listTopics(changed?.effect?.topicsLeftOut)).not.toContain(LEFT_OUT);
  });

  it("says a topic comes in when the learner sees it out and the change brings it in", async () => {
    const { goal, leftOutSkill, plan } = await setup({ dailyMinutes: 30 });
    await leaveOut({ planId: plan.id, skillId: leftOutSkill?.id ?? "" });

    const changed = await change(goal.id, [{ kind: "setDailyMinutes", minutes: 60 }]);

    expect(listTopics(changed?.effect?.topicsAdded)).toContain(LEFT_OUT);
    expect(changed?.effect?.lessonsAdded).toBeGreaterThan(0);
  });

  it("names the lessons it leaves out of the plan the learner sees", async () => {
    const { goal, plan } = await setup({ dailyMinutes: 30 });
    const shown = await listTodoTitles(plan.id);

    const changed = await change(goal.id, [{ kind: "setDailyMinutes", minutes: 8 }]);
    const now = new Set(await listTodoTitles(plan.id));
    const gone = shown.filter((title) => !now.has(title));

    expect(gone.length).toBeGreaterThan(0);
    expect(changed?.effect?.lessonsLeftOut).toStrictEqual(gone);
  });

  it("never offers a focus that leaves its area fewer lessons than the learner sees", async () => {
    const { english, goal, plan } = await setupStandIns();

    // The plan the learner sees has more of English's lessons than any plan made today could.
    await prisma.planItem.updateMany({
      data: { lessons: 40 },
      where: { lessonId: null, planId: plan.id, skillId: { in: english }, status: "todo" },
    });

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ areas: ["Inglês"], kind: "focusAreas" }] },
      }),
    ).resolves.toMatchObject({ status: "unchanged" });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  });
});

describe("a plan that changes as the learner studies says so", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records the topics a refresh leaves out, for Today to say", async () => {
    const { goal, plan } = await setup({ dailyMinutes: 12 });
    const before = await listPlannedTopics(plan.id);

    // The lessons written since take twice the time: the same days now fit fewer topics.
    await prisma.lesson.updateMany({
      data: { estimatedMinutes: 12 },
      where: { skills: { some: { skillId: { in: await listPlanSkillIds(plan.id) } } } },
    });

    await refreshGoalPlan({ goalId: goal.id });

    const after = await listPlannedTopics(plan.id);
    const gone = before.filter((topic) => !after.includes(topic));

    expect(gone.length).toBeGreaterThan(0);

    const changes = await prisma.planChange.findMany({ where: { planId: plan.id } });

    const said = changes.flatMap((recorded) =>
      listTopics(parseEffect(recorded.payload)?.topicsLeftOut),
    );

    expect(said.toSorted()).toStrictEqual(gone.toSorted());
  });
});

describe("more of one subject and less of another", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const MORE_LESS: LearnerPlanOperation[] = [
    { areas: ["Matemática"], kind: "reduceAreas" },
    { areas: ["Inglês"], kind: "focusAreas", parts: [] },
  ];

  // Sofia's "less Philosophy, more Civil" with every lesson in her plan: each kept its lessons and
  // the card said "Adds 5 lessons and leaves out 9" while only her reviews moved.
  it("finishes the subject asked for sooner when everything fits, and the card says what moved", async () => {
    const { goal, plan } = await setup({ dailyMinutes: 60 });
    const before = await readAreas(plan.id);

    const changed = await change(goal.id, MORE_LESS);
    const after = await readAreas(plan.id);

    expect(after.get("Inglês")?.lessons).toBe(before.get("Inglês")?.lessons);
    expect(toTime(after.get("Inglês"))).toBeLessThan(toTime(before.get("Inglês")));

    expect(toTime(after.get("Matemática"))).toBeGreaterThanOrEqual(
      toTime(before.get("Matemática")),
    );

    const ends = (area: string) => ({
      after: after.get(area)?.last,
      area,
      before: before.get(area)?.last,
    });

    // Less of math keeps every lesson because everything still fits: the card says when it ends,
    // moved or not, so "less math" never reads as doing something it didn't.
    expect(after.get("Matemática")?.lessons).toBe(before.get("Matemática")?.lessons);
    expect(changed?.effect?.areaEnds).toStrictEqual([ends("Inglês"), ends("Matemática")]);
    expect(changed?.effect).toMatchObject(countSavedChange({ after, before }));
  });

  it("never offers less of a subject when it would keep every lesson and end when it does", async () => {
    const { goal, plan } = await setup({ dailyMinutes: 60 });

    // Every lesson fits, and math ends when it did even with less of it: nothing to offer.
    await expect(
      proposePlanChange({
        goalId: goal.id,
        operations: [{ areas: ["Matemática"], kind: "reduceAreas" }],
        reason: "Less math.",
        source: "planEdit",
      }),
    ).resolves.toMatchObject({ status: "unchanged" });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  });

  // IELTS seed 1056: on day one, more reading with less writing ended writing two days
  // sooner than the plan the learner saw, which an earlier run had laid out looser than planning
  // again from today does. The buddy never offers such a change; the editor applied it.
  it("never applies more of one subject and less of another that ends the other sooner than the learner sees", async () => {
    const { goal, plan } = await setup({ dailyMinutes: 60 });

    const last = await prisma.planItem.findFirstOrThrow({
      orderBy: { scheduledFor: "desc" },
      where: { kind: "lesson", planId: plan.id, skillId: { in: await listAreaSkills(plan.id) } },
    });

    await prisma.planItem.update({
      data: { scheduledFor: new Date("2020-10-16T00:00:00Z") },
      where: { id: last.id },
    });

    const before = await readAreas(plan.id);

    await expect(
      changeGoalPlan({ goalId: goal.id, input: { operations: MORE_LESS } }),
    ).resolves.toStrictEqual({ reason: "alreadyIn", status: "unchanged" });

    await expect(readAreas(plan.id)).resolves.toStrictEqual(before);
    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  });

  // Sofia's OAB plan after a mock: with more Civil Law and less Philosophy, the
  // mock's "more Ethics" added Ethics beside Civil Law. Ethics had every lesson in from day one
  // and gained nothing, yet sharing the time moved Civil Law's lessons, so the change was applied
  // and the mock said Ethics got more time.
  it("never applies a subject added to the focus that gains nothing, whatever the one focused before does", async () => {
    const { goal, plan } = await setup({
      dailyMinutes: 25,
      lessonMinutes: [6, 12],
      settings: { focusAreas: ["Matemática"], reducedAreas: ["Inglês"] },
      skills: SKILLS.filter((skill) => skill.topic !== "Direito: aplicação").map((skill) =>
        skill.area === "Direito" ? { ...skill, lessons: 2 } : skill,
      ),
    });

    const before = await readAreas(plan.id);

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ areas: ["Matemática", "Direito"], kind: "focusAreas" }] },
      }),
    ).resolves.toStrictEqual({ reason: "alreadyIn", status: "unchanged" });

    await expect(readAreas(plan.id)).resolves.toStrictEqual(before);
    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  });

  // Rafaela's "more Legislative Process, less Linguistics", short on time.
  it("gives the subject asked for more lessons and the other fewer when time is short, as the card says", async () => {
    const { goal, plan } = await setup({ dailyMinutes: 25 });
    const before = await readAreas(plan.id);

    const changed = await change(goal.id, MORE_LESS);
    const after = await readAreas(plan.id);

    expect(after.get("Inglês")?.lessons ?? 0).toBeGreaterThan(before.get("Inglês")?.lessons ?? 0);

    expect(after.get("Matemática")?.lessons ?? 0).toBeLessThan(
      before.get("Matemática")?.lessons ?? 0,
    );

    // The time comes from the subject the learner wants less of, never from another one.
    expect(after.get("Direito")?.lessons ?? 0).toBeGreaterThanOrEqual(
      before.get("Direito")?.lessons ?? 0,
    );

    expect(changed?.effect).toMatchObject(countSavedChange({ after, before }));
  });

  // Ana's "more Linguagens", short on time: Linguagens gained 96 lessons and ended in October
  // instead of August, and her card said only that she'd finish it later.
  it("says how many more lessons the subject asked for gets when that ends it later", async () => {
    const { goal, plan } = await setup({ dailyMinutes: 25, mockMinutes: 60 });
    const before = await readAreas(plan.id);

    const changed = await change(goal.id, [{ areas: ["Direito"], kind: "focusAreas", parts: [] }]);
    const after = await readAreas(plan.id);
    const [was, now] = [before.get("Direito"), after.get("Direito")];

    expect(now?.lessons ?? 0).toBeGreaterThan(was?.lessons ?? 0);
    expect(toTime(now)).toBeGreaterThan(toTime(was));

    expect(changed?.effect?.areaEnds).toContainEqual({
      after: now?.last,
      area: "Direito",
      before: was?.last,
      lessonsGained: (now?.lessons ?? 0) - (was?.lessons ?? 0),
    });
  });

  // Rafaela's "less Linguistics" took 43 lessons from political science and administrative law and left
  // linguistics' alone. With more of another subject, see "gives the subject asked for more lessons".
  it("takes the time from the subject the learner wants less of, never from another one", async () => {
    const { goal, plan } = await setup({ dailyMinutes: 25 });
    const before = await readAreas(plan.id);

    await change(goal.id, [{ areas: ["Matemática"], kind: "reduceAreas" }]);
    const after = await readAreas(plan.id);

    expect(after.get("Matemática")?.lessons ?? 0).toBeLessThan(
      before.get("Matemática")?.lessons ?? 0,
    );

    expect(after.get("Direito")?.lessons ?? 0).toBeGreaterThanOrEqual(
      before.get("Direito")?.lessons ?? 0,
    );

    expect(after.get("Inglês")?.lessons ?? 0).toBeGreaterThanOrEqual(
      before.get("Inglês")?.lessons ?? 0,
    );
  });

  // Sofia's "more Civil, less Philosophy" opened today with 5 criminal procedure lessons and moved
  // ethics, her heaviest subject, from first to 18th.
  it("keeps today's lessons first, as the learner sees them, but the ones of the subject they want less of", async () => {
    const { goal, plan } = await setup({ dailyMinutes: 60 });
    const named = new Set<string>(["Matemática"]);
    const before = await listTodayKeys({ exceptAreas: named, planId: plan.id });

    expect(before.length).toBeGreaterThan(0);

    await change(goal.id, MORE_LESS);
    const after = await listTodayKeys({ exceptAreas: named, planId: plan.id });

    // They open the day as before; time the change frees today may add lessons after them.
    expect(after.slice(0, before.length)).toStrictEqual(before);
  });
});

/** Today's lessons still to do, in the plan's order, of every area but `exceptAreas`. */
async function listTodayKeys({
  exceptAreas,
  planId,
}: {
  exceptAreas: ReadonlySet<string>;
  planId: string;
}): Promise<string[]> {
  const [items, { graph }] = await Promise.all([
    prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: {
        kind: "lesson",
        planId,
        scheduledFor: new Date("2020-09-28T00:00:00Z"),
        status: "todo",
      },
    }),
    prisma.plan.findUniqueOrThrow({ where: { id: planId } }),
  ]);

  const areaOf = new Map(parsePlanGraph(graph).skills.map((skill) => [skill.skillId, skill.area]));

  return items
    .filter((item) => !exceptAreas.has(areaOf.get(item.skillId ?? "") ?? ""))
    .map((item) => item.lessonId ?? item.skillId ?? "");
}

/** The skills of the subject the learner wants less of, as the plan's graph files them. */
async function listAreaSkills(planId: string): Promise<string[]> {
  const { graph } = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });

  return parsePlanGraph(graph)
    .skills.filter((skill) => skill.area === "Matemática")
    .map((skill) => skill.skillId);
}

type AreaRead = { last: string; lessons: number; skills: Map<string, number> };

function toTime(read: AreaRead | undefined): number {
  return read ? Date.parse(read.last) : Number.NaN;
}

/**
 * Each area's lessons still to do in the saved plan, as every screen counts them (a stand-in as
 * the lessons it was saved with), each skill's, and the day its last one is due.
 */
async function readAreas(planId: string): Promise<Map<string, AreaRead>> {
  const [items, { graph }] = await Promise.all([
    prisma.planItem.findMany({ where: { kind: "lesson", planId, status: "todo" } }),
    prisma.plan.findUniqueOrThrow({ where: { id: planId } }),
  ]);

  const areaOf = new Map(parsePlanGraph(graph).skills.map((skill) => [skill.skillId, skill.area]));

  return items.reduce((areas, item) => {
    const area = areaOf.get(item.skillId ?? "") ?? "";
    const read = areas.get(area) ?? { last: "", lessons: 0, skills: new Map<string, number>() };
    const lessons = item.lessonId ? 1 : (item.lessons ?? 1);
    const day = item.scheduledFor?.toISOString().slice(0, 10) ?? "";
    const skillId = item.skillId ?? "";

    read.skills.set(skillId, (read.skills.get(skillId) ?? 0) + lessons);

    return areas.set(area, {
      last: day > read.last ? day : read.last,
      lessons: read.lessons + lessons,
      skills: read.skills,
    });
  }, new Map<string, AreaRead>());
}

/** Each skill's lessons in these areas. */
function listSkillLessons(areas: Map<string, AreaRead>): Map<string, number> {
  return new Map([...areas.values()].flatMap((area) => [...area.skills]));
}

/** The lessons `from` has beyond `to`, skill by skill. */
function countGained(from: Map<string, number>, to: Map<string, number>): number {
  return [...from].reduce(
    (total, [skillId, lessons]) => total + Math.max(0, lessons - (to.get(skillId) ?? 0)),
    0,
  );
}

/** The lessons the saved plan gained and lost, skill by skill: what the card must say. */
function countSavedChange({
  after,
  before,
}: {
  after: Map<string, AreaRead>;
  before: Map<string, AreaRead>;
}) {
  const [was, now] = [listSkillLessons(before), listSkillLessons(after)];
  return { lessonsAdded: countGained(now, was), lessonsRemoved: countGained(was, now) };
}

/** The notice topics the plan's saved items teach. */
async function listPlannedTopics(planId: string): Promise<string[]> {
  const items = await prisma.planItem.findMany({ where: { kind: "lesson", planId } });
  const planned = new Set(items.map((item) => item.skillId));
  const { graph } = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const skills = parsePlanGraph(graph).skills.filter((skill) => planned.has(skill.skillId));

  return skills.flatMap((skill) => skill.topics ?? []);
}

async function listPlanSkillIds(planId: string): Promise<string[]> {
  const { graph } = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  return parsePlanGraph(graph).skills.map((skill) => skill.skillId);
}

function parseEffect(payload: unknown) {
  return parsePlanChangePayload(payload).effect;
}

async function listTodoTitles(planId: string): Promise<string[]> {
  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "lesson", planId, status: "todo" },
  });

  return items.map((item) => item.titleSnapshot);
}

/**
 * The same exam with each skill's lessons not written yet past its first three, short on time:
 * every skill plans the rest as a stand-in, which the plan saves with the lessons it teaches.
 */
async function setupStandIns() {
  const user = await userFixture();
  const blueprint = await examBlueprintFixture({});

  const library = await planLibraryFixture({
    phases: ["Basics", "Further"],
    skills: SKILLS.map((skill) => ({ area: skill.area, lessons: 3, phase: skill.phase, size: 12 })),
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 20,
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-10-19T00:00:00Z"),
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  const english = library.skills
    .filter((_, index) => SKILLS[index]?.area === "Inglês")
    .map((skill) => skill.id);

  return { english, goal, plan };
}
