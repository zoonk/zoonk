import {
  type PlacementItemsParams,
  generatePlacementItems,
} from "@zoonk/ai/tasks/v2/items/placement-items";
import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { trackServerEvent } from "@zoonk/core/analytics/server";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { taskResult } from "../_test-utils/recorded-outputs";
import { prepareGraphPlacement } from "./goal-placement-items";
import { preparePlacementItemsStep } from "./steps/goal-lookahead-steps";

// Writing questions is a paid model call.
vi.mock("@zoonk/ai/tasks/v2/items/placement-items", () => ({ generatePlacementItems: vi.fn() }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("@zoonk/core/analytics/server", () => ({
  trackServerEvent: vi.fn(),
  trackSystemEvent: vi.fn(),
}));

const CITATION = { passage: "Conforme o edital.", sourceId: "notice" };

/** Polícia Federal's notice as research reads it: assertions judged Certo or Errado. */
const CEBRASPE_STRUCTURE = {
  formats: [
    { citation: CITATION, description: "Itens Certo ou Errado.", kind: "trueFalse", options: null },
  ],
  mock: null,
  rules: [],
  subjects: [],
};

const MULTIPLE_CHOICE_STRUCTURE = {
  formats: [
    { citation: CITATION, description: "Questões objetivas.", kind: "multipleChoice", options: 5 },
  ],
  mock: null,
  rules: [],
  subjects: [],
};

const QUICK_ITEMS = {
  multipleChoice: {
    context: null,
    difficulty: "medium",
    format: "multipleChoice",
    options: [
      { isCorrect: true, misconception: null, reason: "It follows the rule.", text: "Right" },
      {
        isCorrect: false,
        misconception: "Applies the rule backwards",
        reason: "You applied the rule backwards.",
        text: "Wrong",
      },
    ],
    question: "Which answer follows the rule?",
  },
  trueFalse: {
    context: null,
    difficulty: "medium",
    format: "trueFalse",
    isTrue: false,
    misconception: "Swaps the rule's exception",
    reason: "The exception is the other way around.",
    statement: "The rule has no exception.",
  },
} as const satisfies Record<PlacementItemsParams["quickFormat"], GeneratedItem>;

const TYPED_ITEM: GeneratedItem = {
  acceptedAnswers: [],
  context: null,
  difficulty: "medium",
  format: "typed",
  keyPoints: ["Names the rule"],
  question: "Which rule applies here, and why?",
  sampleAnswer: "The rule, because the case fits it.",
};

/** What the writer returns: the questions it was asked for, for every skill in the call. */
function writtenFor(params: PlacementItemsParams) {
  return taskResult({
    skills: params.skills.map(() => ({
      quick: [QUICK_ITEMS[params.quickFormat]],
      typed: params.typedCount > 0 ? [TYPED_ITEM] : [],
    })),
  });
}

async function goalWithSkills({
  count,
  kind = "learn",
}: {
  count: number;
  kind?: "exam" | "learn";
}) {
  const user = await userFixture();

  const [goal, skills] = await Promise.all([
    goalFixture({ kind, userId: user.id }),
    Promise.all(Array.from({ length: count }, () => skillFixture())),
  ]);

  await planFixture({ goalId: goal.id });

  return { goal, skillIds: skills.map((skill) => skill.id) };
}

function countItems({ format, skillIds }: { format: GeneratedItem["format"]; skillIds: string[] }) {
  return prisma.item.count({ where: { format, skillId: { in: skillIds } } });
}

function calledSkillCounts() {
  return vi
    .mocked(generatePlacementItems)
    .mock.calls.map(([params]) => params.skills.length)
    .toSorted((a, b) => a - b);
}

const context = { analytics: { distinctId: "learner" }, workflowRunId: "goal-run" };

/** A skill graph whose every skill is a course of its own, so placement picks each one. */
function oneCoursePerSkill(keys: string[]): GoalSkillGraph {
  return {
    courses: keys.map((key) => ({ key, levels: ["beginner"], title: `Course ${key}` })),
    estimatedHours: 10,
    phases: [{ estimatedHours: 10, milestone: "Milestone", title: "Phase 1" }],
    skills: keys.map((key) => ({
      course: key,
      description: key,
      estimatedLessons: 1,
      examWeight: null,
      key,
      level: "beginner",
      name: key,
      phase: 1,
      prerequisites: [],
    })),
  };
}

describe(prepareGraphPlacement, () => {
  beforeEach(() => {
    vi.mocked(generatePlacementItems).mockReset();
    vi.mocked(generatePlacementItems).mockImplementation(async (params) => writtenFor(params));
  });

  it("writes the picked skills a few per call, with a quick and a typed question each", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 7 });
    const keys = skillIds.map((_, index) => `skill-${index}`);

    const saved = Promise.resolve({
      idsByKey: Object.fromEntries(skillIds.map((id, index) => [keys[index]!, id])),
    });

    await prepareGraphPlacement({
      context,
      goalId: goal.id,
      graph: oneCoursePerSkill(keys),
      saved,
    });

    // Seven skills in four calls instead of fourteen, all at the priority tier.
    expect(calledSkillCounts()).toStrictEqual([1, 2, 2, 2]);

    expect(vi.mocked(generatePlacementItems).mock.calls[0]?.[0]).toMatchObject({
      examFormat: null,
      quickCount: 1,
      quickFormat: "multipleChoice",
      serviceTier: "priority",
      typedCount: 1,
    });

    await expect(countItems({ format: "multipleChoice", skillIds })).resolves.toBe(7);
    await expect(countItems({ format: "typed", skillIds })).resolves.toBe(7);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ placementPreparedAt: expect.any(Date) });

    expect(getStreamedEvents()).toStrictEqual([
      expect.objectContaining({ status: "started", step: "preparePlacement" }),
      expect.objectContaining({ status: "completed", step: "preparePlacement" }),
    ]);

    expect(trackServerEvent).not.toHaveBeenCalled();
  });

  it("tries a failed call once more, and counts a call that fails twice as its skills", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 6 });
    const failing = await skillFixture({ name: `Always fails ${crypto.randomUUID()}` });

    vi.mocked(generatePlacementItems)
      .mockRejectedValueOnce(new Error("Provider hiccup"))
      .mockImplementation(async (params) => {
        if (params.skills.some((skill) => skill.name === failing.name)) {
          throw new Error("Provider unavailable");
        }

        return writtenFor(params);
      });

    await expect(
      preparePlacementItemsStep({ ...context, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, written: 6 });

    // The first pick alone, then calls of two; the first tried again after its hiccup.
    expect(calledSkillCounts()).toStrictEqual([1, 1, 1, 2, 2]);

    vi.mocked(generatePlacementItems).mockClear();

    const other = await goalWithSkills({ count: 2 });

    await expect(
      preparePlacementItemsStep({
        ...context,
        goalId: other.goal.id,
        skillIds: [...other.skillIds, failing.id],
      }),
    ).resolves.toStrictEqual({ failed: 2, written: 1 });

    // The failing call twice, then its two skills are left to lessons and reviews; the other
    // call's skill is written.
    expect(calledSkillCounts()).toStrictEqual([1, 2, 2]);
  });

  it("writes an exam's true/false questions under its blueprint once research has read its notice", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2, kind: "exam" });

    // Before the notice is read, placement's questions are general multiple choice.
    await preparePlacementItemsStep({ ...context, goalId: goal.id, skillIds });

    const blueprint = await examBlueprintFixture({
      name: "Polícia Federal",
      role: "Agente",
      structure: CEBRASPE_STRUCTURE,
    });

    await prisma.goal.update({ data: { examBlueprintId: blueprint.id }, where: { id: goal.id } });
    vi.mocked(generatePlacementItems).mockClear();

    await expect(
      preparePlacementItemsStep({ ...context, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, written: 2 });

    // Only the quick questions the exam asks: the typed ones written before still confirm.
    expect(vi.mocked(generatePlacementItems).mock.calls).toStrictEqual([
      [
        expect.objectContaining({
          examFormat: expect.objectContaining({ name: "Polícia Federal, Agente" }),
          quickFormat: "trueFalse",
          typedCount: 0,
        }),
      ],
      [expect.objectContaining({ quickFormat: "trueFalse", typedCount: 0 })],
    ]);

    const trueFalse = await prisma.item.findMany({
      where: { format: "trueFalse", skillId: { in: skillIds } },
    });

    expect(trueFalse).toHaveLength(2);
    expect(trueFalse.every((item) => item.examBlueprintId === blueprint.id)).toBe(true);
    await expect(countItems({ format: "typed", skillIds })).resolves.toBe(2);

    // A later call finds them.
    vi.mocked(generatePlacementItems).mockClear();
    await preparePlacementItemsStep({ ...context, goalId: goal.id, skillIds });
    expect(generatePlacementItems).not.toHaveBeenCalled();
  });

  it("writes nothing more for a multiple-choice exam when its notice lands", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2, kind: "exam" });
    await preparePlacementItemsStep({ ...context, goalId: goal.id, skillIds });

    const blueprint = await examBlueprintFixture({
      name: "ENEM",
      structure: MULTIPLE_CHOICE_STRUCTURE,
    });

    await prisma.goal.update({ data: { examBlueprintId: blueprint.id }, where: { id: goal.id } });
    vi.mocked(generatePlacementItems).mockClear();

    await expect(
      preparePlacementItemsStep({ ...context, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, written: 0 });

    expect(generatePlacementItems).not.toHaveBeenCalled();
  });
});
