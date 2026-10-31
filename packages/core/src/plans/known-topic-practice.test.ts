import { type Skill, prisma } from "@zoonk/db";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadPlacementPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut, markSkillsKnown } from "../learner/_utils/known-skills";
import { getGoalPreparation } from "../preparation/get-goal-preparation";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { answerStudyQuestion } from "../sessions/answer-study-question";
import { readBlockPayload } from "../sessions/block-payload";
import { startStudyBlock } from "../sessions/start-study-block";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { createGoalPlan } from "./create-goal-plan";
import { type PlanGraph } from "./planner/plan-state";

const TODAY = new Date("2026-10-08T00:00:00Z");
const DAY_MS = 86_400_000;
const STUDY_DAY_SECONDS = 30 * 60;

function day(offset: number): Date {
  return new Date(TODAY.getTime() + offset * DAY_MS);
}

function setClock(offset: number) {
  const now = new Date(day(offset).getTime() + 12 * 60 * 60 * 1000);

  vi.setSystemTime(now);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: day(offset),
    currentInstant: now,
    timeZone: "UTC",
  });
}

const RIGHT = 0;
const WRONG = 1;

const NOTES = "4) Organelas (CAI MUITO!!)";
const ANNOUNCEMENT = "A prof disse: vai ter uma dissertativa sobre osmose!";

function subject({ name, topics }: { name: string; topics: string[] }) {
  return {
    citation: { passage: name, sourceId: "notes" },
    name,
    questions: null,
    topics,
    weight: null,
  };
}

function frequency({ level, topic }: { level: "high" | "low"; topic: string }) {
  return {
    appearances: null,
    basis: NOTES,
    citation: { passage: NOTES, sourceId: "notes" },
    level,
    subject: "Biologia",
    topic,
  };
}

function withTopics({ graph, topics }: { graph: PlanGraph; topics: string[] }): PlanGraph {
  return {
    ...graph,
    skills: graph.skills.map((skill, index) => ({ ...skill, topics: [topics[index] ?? ""] })),
  };
}

type Shape = {
  blueprint: Parameters<typeof examBlueprintFixture>[0];
  days: number;
  ownMaterial: boolean;
  topics: string[];
};

async function setup(
  shape: Shape,
  { dailyMinutes = 30, testOut = true }: { dailyMinutes?: number; testOut?: boolean } = {},
) {
  const user = await userFixture();

  const [blueprint, library] = await Promise.all([
    examBlueprintFixture(
      shape.ownMaterial
        ? { ...shape.blueprint, ownerId: user.id, visibility: "private" }
        : shape.blueprint,
    ),
    planLibraryFixture({
      skills: [
        { area: "Biologia", lessons: 3, weight: 4 },
        { area: "Biologia", lessons: 2, weight: 5 },
        { area: "Biologia", lessons: 1, weight: 2 },
        { area: "Biologia", lessons: 1, weight: 3 },
      ],
    }),
  ]);

  const [missed, frequent, ordinary, studied] = library.skills as [Skill, Skill, Skill, Skill];

  const { goal, plan } = await unplannedGoalFixture({
    // PostgreSQL's default clock is real; the free week must start on this fixture's frozen day.
    createdAt: TODAY,
    dailyMinutes,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: day(shape.days),
    timezone: "UTC",
    userId: user.id,
  });

  const items = await Promise.all(
    library.skills.flatMap((skill) =>
      [0, 1, 2, 3].map(() => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
    ),
  );

  const itemsOf = (skill: Skill) => items.filter((item) => item.skillId === skill.id);

  const placementAnswer = ({ isCorrect, skill }: { isCorrect: boolean; skill: Skill }) =>
    attemptFixture({
      answeredAt: day(-1),
      isCorrect,
      itemId: itemsOf(skill)[0]?.id ?? null,
      skillId: skill.id,
      userId: user.id,
    });

  await Promise.all([
    placementAnswer({ isCorrect: false, skill: missed }),
    placementAnswer({ isCorrect: true, skill: frequent }),
    placementAnswer({ isCorrect: true, skill: ordinary }),
    learnerSkillFixture({
      difficulty: 5,
      due: day(-1),
      lastReviewedAt: day(-6),
      reps: 2,
      skillId: studied.id,
      stability: 2,
      state: "learning",
      userId: user.id,
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);

  await createGoalPlan({
    goalId: goal.id,
    graph: withTopics({ graph: library.graph, topics: shape.topics }),
  });

  const known = [frequent.id, ordinary.id];
  const placed = await loadPlacementPlan(goal.id);

  await markSkillsKnown({ knownAt: day(-1), skillIds: known, timeZone: "UTC", userId: user.id });

  if (!testOut) {
    return { frequent, goal, itemsOf, missed, ordinary, plan, studied, user };
  }

  await markPlanItemsTestedOut({
    goalId: goal.id,
    items: placed.items,
    knownSkillIds: new Set(known),
    placedSkills: placed.skills,
    testedOutAt: new Date(day(-1).getTime() + 60_000),
    timeZone: "UTC",
  });

  return { frequent, goal, itemsOf, missed, ordinary, plan, studied, user };
}

async function startPractice(goalId: string) {
  const result = await getTodayStudySession({ goalId });

  if (result.status !== "ready") {
    throw new Error(`Expected the day's session, got ${result.status}`);
  }

  const block = result.session.blocks.find((candidate) => candidate.kind === "practice");

  if (!block) {
    throw new Error("Expected a practice block");
  }

  const row = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
  await startStudyBlock({ blockId: block.id, input: {}, sessionId: result.session.id });

  return { blockId: block.id, payload: readBlockPayload(row), sessionId: result.session.id };
}

async function loadLessonItems({ planId, skillId }: { planId: string; skillId: string }) {
  const lessons = await prisma.lessonSkill.findMany({
    select: { lessonId: true },
    where: { skillId },
  });

  return prisma.planItem.findMany({
    where: { kind: "lesson", lessonId: { in: lessons.map((row) => row.lessonId) }, planId },
  });
}

async function readCoverage(goalId: string) {
  const result = await getGoalPreparation(goalId);

  if (result.status !== "ready") {
    throw new Error(`Expected preparation, got ${result.status}`);
  }

  return result.preparation.components.coverage;
}

const PEDRO: Shape = {
  blueprint: {
    name: "Prova de biologia",
    structure: {
      formats: [
        {
          citation: { passage: ANNOUNCEMENT, sourceId: "notes" },
          description: "Dissertativa sobre osmose",
          kind: "essay",
          options: null,
        },
      ],
      mock: null,
      rules: [],
      subjects: [subject({ name: "Biologia", topics: ["Osmose", "Organelas", "Núcleo", "Vírus"] })],
    },
    topicFrequency: [frequency({ level: "high", topic: "Organelas" })],
  },
  days: 2,
  ownMaterial: true,
  topics: ["Osmose", "Organelas", "Núcleo", "Vírus"],
};

const PUBLIC_EXAM: Shape = {
  blueprint: {
    name: "Vestibular de biologia",
    structure: {
      formats: [],
      mock: null,
      rules: [],
      subjects: [
        subject({ name: "Biologia", topics: ["Evolução", "Genética", "Ecologia", "Citologia"] }),
      ],
    },
    topicFrequency: [
      frequency({ level: "high", topic: "Genética" }),
      frequency({ level: "low", topic: "Ecologia" }),
    ],
  },
  days: 30,
  ownMaterial: false,
  topics: ["Evolução", "Genética", "Ecologia", "Citologia"],
};

describe.each([
  ["a class test whose notes say a known topic comes up a lot (Pedro)", PEDRO],
  ["a public exam whose past papers ask a known topic most", PUBLIC_EXAM],
])("%s", (_, shape) => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("frees known topics from their lessons, never from practice: the most asked one first, the others as time allows", async () => {
    const { frequent, goal, itemsOf, missed, ordinary, plan, studied } = await setup(shape);

    const [frequentLessons, ordinaryLessons, missedLessons] = await Promise.all([
      loadLessonItems({ planId: plan.id, skillId: frequent.id }),
      loadLessonItems({ planId: plan.id, skillId: ordinary.id }),
      loadLessonItems({ planId: plan.id, skillId: missed.id }),
    ]);

    expect(frequentLessons.every((item) => item.status === "testedOut")).toBe(true);
    expect(ordinaryLessons.every((item) => item.status === "testedOut")).toBe(true);
    expect(missedLessons.some((item) => item.status === "todo")).toBe(true);

    const { payload } = await startPractice(goal.id);
    const ids = (skill: Skill) => new Set(itemsOf(skill).map((item) => item.id));
    const position = (skill: Skill) => payload.itemIds.findIndex((id) => ids(skill).has(id));

    expect(position(frequent)).toBe(0);
    expect(position(studied)).toBeGreaterThan(0);
    expect(position(ordinary)).toBeGreaterThan(position(studied));
    expect(payload.itemIds.filter((id) => ids(frequent).has(id))).toHaveLength(1);
    expect(payload.itemIds.filter((id) => ids(ordinary).has(id))).toHaveLength(1);
  });

  it("counts a known topic as covered only once practice confirms it", async () => {
    const { frequent, goal, itemsOf } = await setup(shape);

    await expect(readCoverage(goal.id)).resolves.toMatchObject({ studiedSkills: 0 });

    const { blockId, payload, sessionId } = await startPractice(goal.id);
    const question = payload.itemIds.find((id) => itemsOf(frequent).some((item) => item.id === id));

    const answer = await answerStudyQuestion({
      blockId,
      input: { answer: { selectedIndex: RIGHT }, durationMs: 4000, itemId: question ?? "" },
      sessionId,
    });

    expect(answer).toMatchObject({ feedback: { isCorrect: true }, status: "ready" });
    await expect(readCoverage(goal.id)).resolves.toMatchObject({ studiedSkills: 1 });
  });

  it("brings a known topic's lessons back when practice misses it, and says so in the plan", async () => {
    const { goal, itemsOf, ordinary, plan } = await setup(shape);
    const { blockId, payload, sessionId } = await startPractice(goal.id);
    const question = payload.itemIds.find((id) => itemsOf(ordinary).some((item) => item.id === id));

    const answer = await answerStudyQuestion({
      blockId,
      input: { answer: { selectedIndex: WRONG }, durationMs: 4000, itemId: question ?? "" },
      sessionId,
    });

    expect(answer).toMatchObject({ feedback: { isCorrect: false }, status: "ready" });

    const lessons = await loadLessonItems({ planId: plan.id, skillId: ordinary.id });

    expect(lessons.length).toBeGreaterThan(0);

    expect(lessons.every((item) => item.status === "todo" && item.scheduledFor !== null)).toBe(
      true,
    );

    await expect(readCoverage(goal.id)).resolves.toMatchObject({ studiedSkills: 0 });

    await expectRelearnChange({ goalId: goal.id, topic: shape.topics[2] });
  });

  it("brings a known topic's lessons back when practice misses it after confirming it", async () => {
    const { goal, itemsOf, ordinary, plan } = await setup(shape);
    const isOrdinary = (id: string) => itemsOf(ordinary).some((item) => item.id === id);
    const first = await startPractice(goal.id);
    const confirm = first.payload.itemIds.find((id) => isOrdinary(id));

    await answerStudyQuestion({
      blockId: first.blockId,
      input: { answer: { selectedIndex: RIGHT }, durationMs: 4000, itemId: confirm ?? "" },
      sessionId: first.sessionId,
    });

    setClock(1);

    const next = await startPractice(goal.id);
    const question = next.payload.itemIds.find((id) => isOrdinary(id));

    expect(question).toBeDefined();

    await answerStudyQuestion({
      blockId: next.blockId,
      input: { answer: { selectedIndex: WRONG }, durationMs: 4000, itemId: question ?? "" },
      sessionId: next.sessionId,
    });

    const lessons = await loadLessonItems({ planId: plan.id, skillId: ordinary.id });

    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.every((item) => item.status === "todo")).toBe(true);
    await expectRelearnChange({ goalId: goal.id, topic: shape.topics[2] });
  });
});

async function expectRelearnChange({ goalId, topic }: { goalId: string; topic?: string }) {
  const [change, today] = await Promise.all([
    prisma.planChange.findFirstOrThrow({
      orderBy: { createdAt: "desc" },
      where: { kind: "relearn", plan: { goalId } },
    }),
    getTodayView({ goalId }),
  ]);

  expect(change.status).toBe("applied");

  expect(parsePlanChangePayload(change.payload).effect).toMatchObject({
    topicsAdded: [{ area: "Biologia", topics: [topic] }],
  });

  expect(today.status === "ready" && today.today.planChange?.kind).not.toBe("relearn");
}

describe("a known topic Pedro's time left without lessons", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("brings its lessons into the plan when practice misses it", async () => {
    const { goal, itemsOf, ordinary, plan } = await setup(PEDRO, {
      dailyMinutes: 15,
      testOut: false,
    });

    await expect(loadLessonItems({ planId: plan.id, skillId: ordinary.id })).resolves.toStrictEqual(
      [],
    );

    const { blockId, payload, sessionId } = await startPractice(goal.id);
    const question = payload.itemIds.find((id) => itemsOf(ordinary).some((item) => item.id === id));

    await answerStudyQuestion({
      blockId,
      input: { answer: { selectedIndex: WRONG }, durationMs: 4000, itemId: question ?? "" },
      sessionId,
    });

    const lessons = await loadLessonItems({ planId: plan.id, skillId: ordinary.id });

    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.every((item) => item.status === "todo")).toBe(true);
  });
});

describe("the day before Pedro's class test", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the known topics in the full review too, the one his notes say comes up a lot first", async () => {
    const { frequent, goal, itemsOf, ordinary } = await setup(PEDRO);

    setClock(1);

    const result = await getTodayStudySession({ goalId: goal.id });

    if (result.status !== "ready") {
      throw new Error(`Expected the day's session, got ${result.status}`);
    }

    const review = result.session.blocks.find((block) => block.fullReview);
    const row = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: review?.id } });
    const { itemIds, skillIds } = readBlockPayload(row);

    expect(skillIds).toStrictEqual(expect.arrayContaining([frequent.id, ordinary.id]));
    expect(itemsOf(frequent).some((item) => item.id === itemIds[0])).toBe(true);
  });
});

describe("a known topic a week after its test-out", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks an ordinary known topic first once a week has passed", async () => {
    const { goal, itemsOf, ordinary, studied, user } = await setup(PUBLIC_EXAM);

    await dailyProgressFixtureMany(
      [0, 1, 2, 3, 4, 5].map((offset) => ({
        date: day(offset),
        timeSpentSeconds: STUDY_DAY_SECONDS,
        userId: user.id,
      })),
    );

    setClock(6);

    const { payload } = await startPractice(goal.id);
    const ids = (skill: Skill) => new Set(itemsOf(skill).map((item) => item.id));
    const position = (skill: Skill) => payload.itemIds.findIndex((id) => ids(skill).has(id));

    expect(position(ordinary)).toBeGreaterThanOrEqual(0);
    expect(position(ordinary)).toBeLessThan(position(studied));
  });
});

describe("a free learner's known topic after the exam plan's first week", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks it in the day's quick review", async () => {
    const { goal, itemsOf, ordinary, user } = await setup(PUBLIC_EXAM);

    await prisma.learnerSkill.updateMany({
      data: { due: day(40) },
      where: { skillId: ordinary.id, userId: user.id },
    });

    setClock(8);

    const result = await getTodayStudySession({ goalId: goal.id });

    if (result.status !== "ready") {
      throw new Error(`Expected the day's session, got ${result.status}`);
    }

    const kinds = result.session.blocks.map((block) => block.kind);
    const review = result.session.blocks.find((block) => block.kind === "review");

    const row = review
      ? await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: review.id } })
      : null;

    const asked = new Set(
      row ? readBlockPayload(row).capsules.flatMap((capsule) => capsule.itemIds) : [],
    );

    expect(kinds).not.toContain("practice");
    expect(kinds).not.toContain("checkpoint");
    expect(itemsOf(ordinary).some((item) => asked.has(item.id))).toBe(true);

    await expect(getSyllabusView({ goalId: goal.id })).resolves.toMatchObject({
      syllabus: { knownTopicsReturn: "reviews" },
    });
  });
});
