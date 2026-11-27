import { type Skill, prisma } from "@zoonk/db";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { pickItemInBlock } from "../_test-utils/shown-choice";
import { lowGuessTapItems } from "../learner/_test-utils/placement-tap-items";
import { loadPlacementPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut, markSkillsKnown } from "../learner/_utils/known-skills";
import { getGoalPreparation } from "../preparation/get-goal-preparation";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { answerStudyQuestion } from "../sessions/answer-study-question";
import { readBlockPayload } from "../sessions/block-payload";
import { startStudyBlock } from "../sessions/start-study-block";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { finishChallengesFixture } from "./_test-utils/finish-challenges";
import { keepPaceOwn } from "./_test-utils/keep-pace-own";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { loadPlanChangeView } from "./_utils/owned-plan";
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
  await keepPaceOwn();

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
      isPlacement: true,
      itemId: itemsOf(skill)[0]?.id ?? null,
      skillId: skill.id,
      userId: user.id,
    });

  await Promise.all([
    placementAnswer({ isCorrect: false, skill: missed }),
    placementAnswer({ isCorrect: true, skill: frequent }),
    placementAnswer({ isCorrect: true, skill: ordinary }),
    ...[ordinary, frequent].map(async (skill) => {
      const taps = await lowGuessTapItems(skill.id);

      return Promise.all(
        taps.map(({ answer, item }) =>
          attemptFixture({
            answer,
            answeredAt: day(-1),
            isCorrect: true,
            isPlacement: true,
            itemId: item.id,
            skillId: skill.id,
            userId: user.id,
          }),
        ),
      );
    }),
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

    await finishChallengesFixture(plan.id);
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
      input: {
        answer: await pickItemInBlock({ blockId, itemId: question ?? "" }),
        durationMs: 4000,
        itemId: question ?? "",
      },
      sessionId,
    });

    expect(answer).toMatchObject({ feedback: { isCorrect: true }, status: "ready" });
    await expect(readCoverage(goal.id)).resolves.toMatchObject({ studiedSkills: 1 });
  });

  it.each([false, true])(
    "rechecks a practice miss before bringing a skipped topic back (practice confirmed: %s)",
    async (confirmed) => {
      const { frequent, goal, itemsOf, ordinary, plan } = await setup({
        ...shape,
        days: confirmed ? Math.max(3, shape.days) : shape.days,
      });

      const isOrdinary = (id: string) => itemsOf(ordinary).some((item) => item.id === id);

      if (confirmed) {
        const first = await startPractice(goal.id);

        await answerStudyQuestion({
          blockId: first.blockId,
          input: {
            answer: await pickItemInBlock({
              blockId: first.blockId,
              itemId: first.payload.itemIds.find(isOrdinary)!,
            }),
            durationMs: 4000,
            itemId: first.payload.itemIds.find(isOrdinary)!,
          },
          sessionId: first.sessionId,
        });

        setClock(1);
      }

      const { blockId, payload, sessionId } = await startPractice(goal.id);

      await expect(
        answerStudyQuestion({
          blockId,
          input: {
            answer: await pickItemInBlock({
              blockId,
              itemId: payload.itemIds.find(isOrdinary)!,
              right: false,
            }),
            durationMs: 4000,
            itemId: payload.itemIds.find(isOrdinary)!,
          },
          sessionId,
        }),
      ).resolves.toMatchObject({ feedback: { isCorrect: false }, status: "ready" });

      const lessonIds = { planId: plan.id, skillId: ordinary.id };
      const skipped = await loadLessonItems(lessonIds);
      expect(skipped.length).toBeGreaterThan(0);
      expect(skipped.every((item) => item.status === "testedOut")).toBe(true);

      await expect(readCoverage(goal.id)).resolves.toMatchObject({
        studiedSkills: confirmed ? 1 : 0,
      });

      const fresh = await lowGuessTapItems(ordinary.id);
      setClock(confirmed ? 2 : 1);

      const next = await getTodayStudySession({ goalId: goal.id });
      expect(next.status).toBe("ready");

      if (next.status !== "ready") {
        throw new Error(`Expected a new study day, got ${next.status}`);
      }

      expect(next.session.id).not.toBe(sessionId);

      const blocks = await prisma.studySessionBlock.findMany({
        where: { sessionId: next.session.id },
      });

      const freshIds = new Set(fresh.map(({ item }) => item.id));

      const recheck = blocks
        .map((block) => ({
          block,
          itemId: readBlockPayload(block).placementRecheckItemIds?.find((id) => freshIds.has(id)),
        }))
        .find(({ itemId }) => itemId);

      expect(recheck?.itemId).toBeDefined();

      const { block: check, itemId } = recheck!;
      await startStudyBlock({ blockId: check.id, input: {}, sessionId: next.session.id });

      await expect(
        answerStudyQuestion({
          blockId: check.id,
          input: { answer: { dontKnow: true }, durationMs: 4000, itemId: itemId! },
          sessionId: next.session.id,
        }),
      ).resolves.toMatchObject({ feedback: { isCorrect: false }, status: "ready" });

      const lessons = await loadLessonItems(lessonIds);
      expect(lessons.length).toBeGreaterThan(0);

      expect(lessons.every((item) => item.status === "todo" && item.scheduledFor !== null)).toBe(
        true,
      );

      const other = await loadLessonItems({ planId: plan.id, skillId: frequent.id });
      expect(other.every((item) => item.status === "testedOut")).toBe(true);

      await expectRelearnChange({ goalId: goal.id, topic: shape.topics[2] });
    },
  );
});

async function expectRelearnChange({ goalId, topic }: { goalId: string; topic?: string }) {
  const change = await prisma.planChange.findFirstOrThrow({
    orderBy: { createdAt: "desc" },
    where: { kind: "relearn", plan: { goalId } },
  });

  expect(change.status).toBe("applied");

  expect(parsePlanChangePayload(change.payload).effect).toMatchObject({
    topicsAdded: [{ area: "Biologia", topics: [topic] }],
  });

  await expect(loadPlanChangeView(change.id)).resolves.toMatchObject({ canUndo: true });
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
    const { goal, itemsOf, ordinary, plan } = await setup(
      { ...PEDRO, blueprint: PUBLIC_EXAM.blueprint },
      { dailyMinutes: 10, testOut: false },
    );

    await expect(loadLessonItems({ planId: plan.id, skillId: ordinary.id })).resolves.toStrictEqual(
      [],
    );

    const { blockId, payload, sessionId } = await startPractice(goal.id);
    const question = payload.itemIds.find((id) => itemsOf(ordinary).some((item) => item.id === id));

    expect(question).toBeDefined();

    await answerStudyQuestion({
      blockId,
      input: {
        answer: await pickItemInBlock({ blockId, itemId: question ?? "", right: false }),
        durationMs: 4000,
        itemId: question ?? "",
      },
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

    await prisma.$transaction([
      prisma.planItem.updateMany({
        data: { completedAt: day(5), status: "done" },
        where: { plan: { goalId: goal.id }, scheduledFor: { lt: day(6) }, status: "todo" },
      }),
      prisma.planItem.deleteMany({
        where: { kind: "review", plan: { goalId: goal.id }, scheduledFor: day(6) },
      }),
    ]);

    setClock(6);

    const { payload } = await startPractice(goal.id);
    const ids = (skill: Skill) => new Set(itemsOf(skill).map((item) => item.id));
    const position = (skill: Skill) => payload.itemIds.findIndex((id) => ids(skill).has(id));

    expect(position(ordinary)).toBeGreaterThanOrEqual(0);
    expect(position(ordinary)).toBeLessThan(position(studied));
  });
});

describe("a free learner's known topic on an older exam goal", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps confirming it in practice after seven days", async () => {
    const { goal, itemsOf, ordinary, user } = await setup(PUBLIC_EXAM);

    await prisma.learnerSkill.updateMany({
      data: { due: day(40) },
      where: { skillId: ordinary.id, userId: user.id },
    });

    setClock(8);

    const { payload } = await startPractice(goal.id);
    const asked = new Set(payload.itemIds);

    expect(itemsOf(ordinary).some((item) => asked.has(item.id))).toBe(true);

    await expect(getSyllabusView({ goalId: goal.id })).resolves.toMatchObject({
      syllabus: { knownTopicsReturn: "practice" },
    });
  });
});
