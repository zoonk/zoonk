import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { loadSkillsToConfirm } from "../learner/_utils/load-skill-claims";
import { finishGoalPlacement } from "../learner/placement/finish-goal-placement";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getGoalPreparation } from "../preparation/get-goal-preparation";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getTodayView } from "../view-models/today/get-today-view";
import { getTodayStudySession } from "./_test-utils/open-today";
import { answerStudyQuestion } from "./answer-study-question";
import { finishStudyBlock } from "./finish-study-block";
import { getStudyBlock } from "./get-study-block";
import { getStudySessionSummary } from "./get-study-session-summary";
import { startStudyBlock } from "./start-study-block";

const TIME_ZONE = "UTC";

const DAY_MS = 86_400_000;

/**
 * A goal set yesterday (placement ran in its onboarding) with one skill placement is unsure of:
 * one right pick so far.
 */
async function setup({ details = {} }: { details?: object } = {}) {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 2, phases: [1], userId: user.id });
  const [first, second] = fixture.items;

  await Promise.all([
    prisma.goal.update({
      data: { createdAt: new Date(Date.now() - DAY_MS), details, timezone: TIME_ZONE },
      where: { id: fixture.goal.id },
    }),
    attemptFixture({
      answer: { selectedIndex: 0 },
      isCorrect: true,
      itemId: first?.id ?? null,
      skillId: first?.skillId ?? null,
      userId: user.id,
    }),
  ]);

  mockSession(user.id);
  return { ...fixture, placementItemId: second?.id ?? "", user };
}

async function openPlacementBlock(goalId: string) {
  const today = await getTodayStudySession({ goalId, timeZone: TIME_ZONE });
  const session = today.status === "ready" ? today.session : null;
  const review = session?.blocks.find((block) => block.kind === "review");

  if (!session || !review) {
    throw new Error("Expected a review block with placement questions");
  }

  await startStudyBlock({ blockId: review.id, input: {}, sessionId: session.id });
  return { blockId: review.id, sessionId: session.id };
}

/**
 * A goal the planner built yesterday, whose one skill placement answered right once: its lessons
 * wait, and the first week's sessions still ask about it.
 */
async function plannedSetup() {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 2 }] });
  const skillId = library.skills[0]?.id ?? "";

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: new Date(Date.now() - DAY_MS),
    timezone: TIME_ZONE,
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const [answered, asked] = await Promise.all([
    itemFixture({ content: choiceItemContent(), skillId }),
    itemFixture({ content: choiceItemContent(), skillId }),
  ]);

  await attemptFixture({
    answeredAt: new Date(Date.now() - DAY_MS),
    isCorrect: true,
    itemId: answered.id,
    skillId,
    userId: user.id,
  });

  mockSession(user.id);
  return { goal, placementItemId: asked.id, plan, skillId };
}

/** Whether the goal's session opens with a review block: placement questions (no capsules are due). */
async function hasReviewBlock({ goal, user }: { goal: { id: string }; user: { id: string } }) {
  mockSession(user.id);
  const today = await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });
  const blocks = today.status === "ready" ? today.session.blocks : [];

  return blocks.some((block) => block.kind === "review");
}

/**
 * Stops the clock where the test starts and says its day as a request would: the setup's
 * "yesterday" and the session's "today" stay a day apart, even when the test runs across midnight.
 */
function mockClock() {
  vi.useFakeTimers({ toFake: ["Date"] });
  const now = new Date();

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    currentInstant: now,
    timeZone: TIME_ZONE,
  });
}

describe("placement in the first week's sessions", () => {
  beforeEach(() => {
    mockClock();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the session with the unsure skill's question, marked as placement", async () => {
    const { goal, placementItemId } = await setup();
    const { blockId, sessionId } = await openPlacementBlock(goal.id);

    const block = await getStudyBlock({ blockId, sessionId });
    const questions = block.status === "ready" ? block.detail.questions : [];

    expect(questions[0]).toMatchObject({ itemId: placementItemId, placement: true });
  });

  it("counts the first week's placement review as a mission before and after finishing it", async () => {
    const { goal, placementItemId } = await setup();
    const today = await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });

    expect(today).toMatchObject({
      session: {
        missions: expect.arrayContaining([
          expect.objectContaining({ done: 0, kind: "review", status: "todo", total: 1 }),
        ]),
      },
      status: "ready",
    });

    const { blockId, sessionId } = await openPlacementBlock(goal.id);

    await answerStudyQuestion({
      blockId,
      input: {
        answer: { dontKnow: true },
        durationMs: 3000,
        itemId: placementItemId,
        timeZone: TIME_ZONE,
      },
      sessionId,
    });

    await expect(finishStudyBlock({ blockId, input: {}, sessionId })).resolves.toMatchObject({
      completion: {
        missions: expect.arrayContaining([
          expect.objectContaining({ done: 1, kind: "review", status: "done", total: 1 }),
        ]),
      },
      status: "ready",
    });

    await expect(
      getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE }),
    ).resolves.toMatchObject({
      session: {
        blocks: expect.arrayContaining([
          expect.objectContaining({ id: blockId, kind: "review", status: "completed" }),
        ]),
        missions: expect.arrayContaining([
          expect.objectContaining({ done: 1, kind: "review", status: "done", total: 1 }),
        ]),
      },
      status: "ready",
    });
  });

  // A first-week review can hold only placement questions (no capsule is due yet): the time spent
  // answering them is time studied, so the summary says it as Today and the week count it.
  it("counts the time spent on placement questions in the session's summary", async () => {
    const { goal, placementItemId } = await setup();
    const { blockId, sessionId } = await openPlacementBlock(goal.id);

    await answerStudyQuestion({
      blockId,
      input: {
        answer: { dontKnow: true },
        durationMs: 3000,
        itemId: placementItemId,
        timeZone: TIME_ZONE,
      },
      sessionId,
    });

    vi.setSystemTime(Date.now() + 90_000);
    await finishStudyBlock({ blockId, input: {}, sessionId });

    await expect(getStudySessionSummary({ input: {}, sessionId })).resolves.toMatchObject({
      status: "ready",
      summary: { minutes: 1 },
    });
  });

  it("asks an exam that judges assertions its own true/false question before multiple choice", async () => {
    const { goal, items } = await setup();
    const skillId = items[0]?.skillId ?? "";

    const exam = await examBlueprintFixture({
      structure: {
        formats: [
          {
            citation: { passage: "Certo ou Errado.", sourceId: "notice" },
            description: "Itens julgados Certo ou Errado.",
            kind: "trueFalse",
            options: null,
          },
        ],
        mock: null,
        rules: [],
        subjects: [],
      },
    });

    const [trueFalse] = await Promise.all([
      itemFixture({
        content: {
          context: null,
          isTrue: true,
          misconception: null,
          reason: "It follows the rule.",
          statement: "The rule applies here.",
        },
        examBlueprintId: exam.id,
        format: "trueFalse",
        skillId,
      }),
      prisma.goal.update({ data: { examBlueprintId: exam.id }, where: { id: goal.id } }),
    ]);

    const { blockId, sessionId } = await openPlacementBlock(goal.id);
    const block = await getStudyBlock({ blockId, sessionId });
    const questions = block.status === "ready" ? block.detail.questions : [];

    expect(questions[0]).toMatchObject({ itemId: trueFalse.id, placement: true });
  });

  it("settles the start from a right answer and skips what the plan no longer needs", async () => {
    const { goal, placementItemId, planItems, user } = await setup();
    const { blockId, sessionId } = await openPlacementBlock(goal.id);

    const result = await answerStudyQuestion({
      blockId,
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 3000,
        itemId: placementItemId,
        timeZone: TIME_ZONE,
      },
      sessionId,
    });

    expect(result).toMatchObject({ feedback: { isCorrect: true }, status: "ready" });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: planItems[0]?.id } }),
    ).resolves.toMatchObject({ status: "testedOut" });

    await expect(
      prisma.learnerSkill.findFirst({ where: { reps: { gt: 0 }, userId: user.id } }),
    ).resolves.not.toBeNull();
  });

  it("brings back the lessons one right answer skipped when the week's question on them is missed", async () => {
    const { goal, placementItemId, plan, skillId } = await plannedSetup();

    const statuses = () =>
      prisma.planItem
        .findMany({ where: { kind: "lesson", planId: plan.id, skillId } })
        .then((items) => [...new Set(items.map((item) => item.status))]);

    await finishGoalPlacement({ goalId: goal.id, input: {} });
    await expect(statuses()).resolves.toStrictEqual(["testedOut"]);

    const { blockId, sessionId } = await openPlacementBlock(goal.id);

    await answerStudyQuestion({
      blockId,
      input: {
        answer: { selectedIndex: 1 },
        durationMs: 3000,
        itemId: placementItemId,
        timeZone: TIME_ZONE,
      },
      sessionId,
    });

    await expect(statuses()).resolves.toStrictEqual(["todo"]);
  });

  // A placement question stays a test inside a session: its right answer frees the topic from its
  // lessons, never from practice, and shows nothing preparation counts.
  it("reads a right placement answer in a session as a test's, never as practice", async () => {
    const { goal, placementItemId, skillId } = await plannedSetup();

    await finishGoalPlacement({ goalId: goal.id, input: {} });
    const { blockId, sessionId } = await openPlacementBlock(goal.id);

    await answerStudyQuestion({
      blockId,
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 3000,
        itemId: placementItemId,
        timeZone: TIME_ZONE,
      },
      sessionId,
    });

    await expect(
      loadSkillsToConfirm({ goalId: goal.id, skillIds: [skillId], userId: goal.userId }),
    ).resolves.toStrictEqual(new Set([skillId]));

    mockClock();
    const preparation = await getGoalPreparation(goal.id);

    expect(
      preparation.status === "ready" && preparation.preparation.components.coverage,
    ).toMatchObject({ studiedSkills: 0 });
  });

  // Pedro's quick review on the day before held a placement question: his right answer skipped
  // lessons and rebuilt the rest of the day, his full review turned into a short practice.
  it("keeps the rest of the day as shown when a placement answer in it skips lessons", async () => {
    const { goal, placementItemId, plan, skillId } = await plannedSetup();
    const { blockId, sessionId } = await openPlacementBlock(goal.id);

    const blocks = () =>
      prisma.studySessionBlock.findMany({ orderBy: { position: "asc" }, where: { sessionId } });

    const shown = await blocks();

    await answerStudyQuestion({
      blockId,
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 3000,
        itemId: placementItemId,
        timeZone: TIME_ZONE,
      },
      sessionId,
    });

    const [after, skipped] = await Promise.all([
      blocks(),
      prisma.planItem.findMany({ where: { planId: plan.id, skillId, status: "testedOut" } }),
    ]);

    const skippedLessons = new Set(skipped.flatMap((item) => item.lessonId ?? []));

    expect(skippedLessons.size).toBeGreaterThan(0);
    expect(after.map((block) => block.id)).toStrictEqual(shown.map((block) => block.id));

    expect(
      after
        .filter((block) => block.lessonId && skippedLessons.has(block.lessonId))
        .map((block) => block.status),
    ).toStrictEqual(
      shown
        .filter((block) => block.lessonId && skippedLessons.has(block.lessonId))
        .map(() => "skipped"),
    );

    // Today says what the answer skipped, with its undo, instead of changing without a word.
    const today = await getTodayView({ goalId: goal.id });

    expect(today.status === "ready" && today.today.planChange).toMatchObject({
      canUndo: true,
      kind: "testedOut",
    });
  });

  it("never saves a wrong placement answer as a mistake", async () => {
    const { goal, placementItemId, user } = await setup();
    const { blockId, sessionId } = await openPlacementBlock(goal.id);

    const result = await answerStudyQuestion({
      blockId,
      input: {
        answer: { dontKnow: true },
        durationMs: 3000,
        itemId: placementItemId,
        timeZone: TIME_ZONE,
      },
      sessionId,
    });

    expect(result).toMatchObject({
      feedback: { isCorrect: false, savedToNotebook: false },
      status: "ready",
    });

    await expect(prisma.mistake.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("asks nothing on the day the goal was set, after the first week, or when the learner chose to start from scratch", async () => {
    const [today, late, declined] = await Promise.all([
      setup(),
      setup(),
      setup({ details: { placementDeclined: true } }),
    ]);

    await Promise.all([
      prisma.goal.update({ data: { createdAt: new Date() }, where: { id: today.goal.id } }),
      prisma.goal.update({
        data: { createdAt: new Date(Date.now() - 10 * DAY_MS) },
        where: { id: late.goal.id },
      }),
    ]);

    await expect(hasReviewBlock(today)).resolves.toBe(false);
    await expect(hasReviewBlock(late)).resolves.toBe(false);
    await expect(hasReviewBlock(declined)).resolves.toBe(false);
  });
});
