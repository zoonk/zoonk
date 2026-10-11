import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { getSyllabusView } from "../../view-models/syllabus/get-syllabus-view";
import {
  ENGLISH,
  ENGLISH_II,
  FOREIGN,
  FOREIGN_LANGUAGE,
  HISTORY,
  LANGUAGES,
  MATH,
  PHILOSOPHY,
  SPANISH,
  SPANISH_HISTORY,
  choiceBlueprintFixture,
  twoChoiceBlueprintFixture,
} from "./_test-utils/choice-blueprint";
import { chooseExamOption } from "./choose-exam-option";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** A Monday in 2020, before other tests' learning events, so pace estimates stay out of it. */
const NOW = new Date("2020-09-28T12:00:00Z");
const TIME_ZONE = "America/Sao_Paulo";

/** An exam learner whose plan is built (or, with `built: false`, still waiting for the planner). */
async function setup({ built = true }: { built?: boolean } = {}) {
  const user = await userFixture();
  const blueprint = await choiceBlueprintFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: LANGUAGES, lessons: 2 },
      { area: ENGLISH, lessons: 1 },
      { area: SPANISH, lessons: 1 },
      { area: MATH, lessons: 2 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  if (built) {
    await createGoalPlan({ goalId: goal.id, graph: library.graph });
  }

  mockSession(user.id);

  return { goal, plan, user };
}

async function loadChoices(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  return parsePlanSettings(plan.settings).examChoices;
}

const spanish = { group: FOREIGN, subject: SPANISH, timeZone: TIME_ZONE };

describe(chooseExamOption, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the learner's option with their plan, as a change they can undo", async () => {
    const { goal, plan } = await setup();

    const result = await chooseExamOption({ goalId: goal.id, input: spanish });

    expect(result).toMatchObject({ change: { status: "applied" }, status: "applied" });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: FOREIGN, subject: SPANISH },
    ]);

    const changeId = result.status === "applied" ? (result.change?.id ?? "") : "";

    const change = await prisma.planChange.findUniqueOrThrow({ where: { id: changeId } });

    expect(change.payload).toMatchObject({
      operations: [{ group: FOREIGN, kind: "setExamChoice", subject: SPANISH }],
      source: "learner",
    });

    // Switching replaces the pick for that choice; undoing brings the earlier one back.
    const english = await chooseExamOption({
      goalId: goal.id,
      input: { ...spanish, subject: ENGLISH },
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: FOREIGN, subject: ENGLISH },
    ]);

    await decidePlanChange({
      changeId: english.status === "applied" ? (english.change?.id ?? "") : "",
      goalId: goal.id,
      input: { status: "undone", timeZone: TIME_ZONE },
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: FOREIGN, subject: SPANISH },
    ]);
  });

  it("keeps the rest of the subject a picked option is part of, as the plan's areas name it, with the option inside it", async () => {
    // Graphs name ENEM's languages area "Linguagens", which begins like "Língua Espanhola" too:
    // picking Spanish must not take the area out of its subject (Lucas M., persona pass 11). The
    // notice counts the language inside that subject, so it's no subject of its own.
    const user = await userFixture();
    const blueprint = await choiceBlueprintFixture();

    const library = await planLibraryFixture({
      skills: [
        { area: "Linguagens", lessons: 2 },
        { area: ENGLISH, lessons: 1 },
        { area: SPANISH, lessons: 1 },
        { area: "Matemática", lessons: 2 },
      ],
    });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 30,
      examBlueprintId: blueprint.id,
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    await chooseExamOption({ goalId: goal.id, input: spanish });

    const result = await getSyllabusView({ goalId: goal.id });
    const syllabus = result.status === "ready" ? result.syllabus : null;

    expect(
      syllabus?.subjects.map((subject) => [subject.name, subject.source, subject.lessonsTotal]),
    ).toStrictEqual([
      [LANGUAGES, "notice", 3],
      [MATH, "notice", 2],
    ]);
  });

  it("changes nothing when the learner picks the option they already take", async () => {
    const { goal } = await setup();

    await chooseExamOption({ goalId: goal.id, input: spanish });
    const again = await chooseExamOption({ goalId: goal.id, input: spanish });

    expect(again).toStrictEqual({ change: null, status: "applied" });

    await expect(prisma.planChange.count({ where: { plan: { goalId: goal.id } } })).resolves.toBe(
      1,
    );
  });

  it("keeps the option for the planner when the plan isn't built yet", async () => {
    const { goal, plan } = await setup({ built: false });

    await expect(chooseExamOption({ goalId: goal.id, input: spanish })).resolves.toStrictEqual({
      change: null,
      status: "applied",
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: FOREIGN, subject: SPANISH },
    ]);
  });

  it("refuses an option the exam doesn't offer, and a choice it doesn't have", async () => {
    const { goal, plan } = await setup();

    await expect(
      chooseExamOption({ goalId: goal.id, input: { ...spanish, subject: "Língua Francesa" } }),
    ).resolves.toStrictEqual({ error: "unknownOption", status: "invalid" });

    await expect(
      chooseExamOption({ goalId: goal.id, input: { ...spanish, subject: LANGUAGES } }),
    ).resolves.toStrictEqual({ error: "unknownOption", status: "invalid" });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([]);
  });

  it("never changes another learner's plan", async () => {
    const { goal } = await setup();
    const other = await userFixture();
    mockSession(other.id);

    await expect(chooseExamOption({ goalId: goal.id, input: spanish })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("changes one choice of an exam with several and keeps the others", async () => {
    const user = await userFixture();
    const blueprint = await twoChoiceBlueprintFixture();

    const { goal, plan } = await unplannedGoalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      language: "es",
      settings: { examChoices: [{ group: HISTORY, subject: SPANISH_HISTORY }] },
      userId: user.id,
    });

    mockSession(user.id);

    await chooseExamOption({
      goalId: goal.id,
      input: { group: FOREIGN_LANGUAGE, subject: ENGLISH_II, timeZone: TIME_ZONE },
    });

    await chooseExamOption({
      goalId: goal.id,
      input: { group: HISTORY, subject: PHILOSOPHY, timeZone: TIME_ZONE },
    });

    await expect(loadChoices(plan.id)).resolves.toStrictEqual([
      { group: HISTORY, subject: PHILOSOPHY },
      { group: FOREIGN_LANGUAGE, subject: ENGLISH_II },
    ]);
  });
});
