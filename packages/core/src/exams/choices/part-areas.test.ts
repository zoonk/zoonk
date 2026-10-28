import { randomUUID } from "node:crypto";
import { interpretPlanEdit } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { claimLessonQuestionAnswer } from "../../lesson-questions/answer-lifecycle";
import { createLessonQuestion } from "../../lesson-questions/create-lesson-question";
import { proposeTutorPlanChange } from "../../lesson-questions/propose-tutor-plan-change";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import {
  ENGLISH,
  FOREIGN,
  LANGUAGES,
  MATH,
  choiceBlueprintFixture,
} from "./_test-utils/choice-blueprint";
import { chooseExamOption } from "./choose-exam-option";

const NOW = new Date("2020-09-28T12:00:00Z");
const TIME_ZONE = "America/Sao_Paulo";

async function setup({
  areas = [LANGUAGES, ENGLISH, MATH],
  lessons = 2,
}: { areas?: string[]; lessons?: number } = {}) {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    choiceBlueprintFixture(),
    planLibraryFixture({ skills: areas.map((area) => ({ area, lessons })) }),
  ]);

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 12,
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  await chooseExamOption({
    goalId: goal.id,
    input: { group: FOREIGN, subject: ENGLISH, timeZone: TIME_ZONE },
  });

  return goal;
}

async function proposeFocusInAnswer({ areas, goalId }: { areas: string[]; goalId: string }) {
  const question = "More of the languages area, please";

  vi.mocked(interpretPlanEdit).mockResolvedValue({
    data: {
      leftOut: [],
      operations: [{ areas, kind: "focusAreas" }],
      summary: "The languages area gets priority.",
      understood: true,
    },
    provenance: {
      generatedAt: NOW.toISOString(),
      latencyMs: 1,
      model: "google/gemini-3.5-flash-lite",
      promptVersion: "test",
      provider: "google",
      requestedModel: "google/gemini-3.5-flash-lite",
      runId: "run-plan-words",
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });

  const created = await createLessonQuestion({
    input: { context: { kind: "plan" }, question, requestId: randomUUID() },
    target: { goalId, kind: "plan" },
  });

  const questionId = created.status === "created" ? created.question.id : "";

  const claimed = await claimLessonQuestionAnswer({
    questionId,
    requestedModel: () => "google/gemini-3.8-flash",
  });

  const revision = claimed.status === "ready" ? claimed.claim.revision : 0;
  const result = await proposeTutorPlanChange({ questionId, request: question, revision });

  if (result.status !== "proposed") {
    throw new Error(`Expected a proposal, received ${result.status}`);
  }

  return result.change;
}

describe("the language an ENEM learner takes, in their plan's areas", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: TIME_ZONE,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is part of the languages area, never an area of its own", async () => {
    const goal = await setup();
    const result = await getGoalPlan(goal.id);
    const areas = result.status === "ready" ? result.plan.areas : [];

    expect(areas.map(({ name, partOf }) => [name, partOf])).toStrictEqual([
      [LANGUAGES, null],
      [ENGLISH, LANGUAGES],
      [MATH, null],
    ]);
  });

  it("is focused with the languages area", async () => {
    const goal = await setup();

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ areas: [LANGUAGES], kind: "focusAreas" }], timeZone: TIME_ZONE },
      saveFocusAnyway: true,
    });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    expect(parsePlanSettings(plan.settings).focusAreas.toSorted()).toStrictEqual(
      [ENGLISH, LANGUAGES].toSorted(),
    );
  });

  it("leaves the focus with the languages area", async () => {
    const goal = await setup();

    const focus = (areas: string[]) =>
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ areas, kind: "focusAreas" }], timeZone: TIME_ZONE },
        saveFocusAnyway: true,
      });

    await focus([LANGUAGES]);
    await focus([MATH]);

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    expect(parsePlanSettings(plan.settings).focusAreas).toStrictEqual([MATH]);
  });

  it("is focused with the languages area when the buddy proposes it, whose card names that area only", async () => {
    const goal = await setup({ areas: [MATH, LANGUAGES, ENGLISH], lessons: 8 });
    const change = await proposeFocusInAnswer({ areas: [LANGUAGES], goalId: goal.id });

    expect(change.operations).toStrictEqual([{ areas: [LANGUAGES], kind: "focusAreas" }]);

    await decidePlanChange({ changeId: change.id, goalId: goal.id, input: { status: "applied" } });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    expect(parsePlanSettings(plan.settings).focusAreas.toSorted()).toStrictEqual(
      [ENGLISH, LANGUAGES].toSorted(),
    );
  });
});
