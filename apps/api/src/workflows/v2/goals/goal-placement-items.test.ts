import { randomUUID } from "node:crypto";
import { generateSearchTerms } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { checkLessonImage } from "@zoonk/ai/tasks/v2/images/check";
import { generateLessonImage } from "@zoonk/ai/tasks/v2/images/generate";
import { generateImageScene } from "@zoonk/ai/tasks/v2/images/scene";
import {
  type PlacementItemsParams,
  generatePlacementItems,
} from "@zoonk/ai/tasks/v2/items/placement-items";
import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { trackServerEvent } from "@zoonk/core/analytics/server";
import { uploadImage } from "@zoonk/core/images/upload";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { listeningGoalFixture } from "@zoonk/testing/fixtures/listening";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { start } from "workflow/api";
import { mockHookConflict } from "../../../../mocks/workflow";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { taskResult } from "../_test-utils/recorded-outputs";
import { TEST_IMAGE, imageProvenance, sceneFor } from "../images/_test-utils/image-results";
import { pictureChecksWorkflow } from "../images/picture-checks-workflow";
import { prepareGraphPlacement } from "./goal-placement-items";
import { preparePlacementItems } from "./placement-items";
import { placementItemsWorkflow } from "./placement-items-workflow";
import { shortPlanPracticeWorkflow } from "./short-plan-practice-workflow";
import { pickPlacementBatchesStep, writePlacementBatchStep } from "./steps/placement-items-steps";

const CITATION = { passage: "Conforme o edital.", sourceId: "notice" };

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
    {
      citation: CITATION,
      description: "Questões objetivas.",
      kind: "multipleChoice",
      options: null,
    },
  ],
  mock: null,
  rules: [],
  subjects: [],
};

const QUICK_ITEMS = {
  multipleChoice: {
    context: null,
    difficulty: "medium",
    fixedOrder: false,
    format: "multipleChoice",
    image: null,
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
    visual: null,
  },
  trueFalse: {
    context: null,
    difficulty: "medium",
    format: "trueFalse",
    image: null,
    isTrue: false,
    misconception: "Swaps the rule's exception",
    reason: "The exception is the other way around.",
    statement: "The rule has no exception.",
    visual: null,
  },
} as const satisfies Record<PlacementItemsParams["quickFormat"], GeneratedItem>;

const TYPED_ITEM: GeneratedItem = {
  acceptedAnswers: [],
  context: null,
  difficulty: "medium",
  format: "typed",
  image: null,
  keyPoints: ["Names the rule"],
  question: "Which rule applies here, and why?",
  sampleAnswer: "The rule, because the case fits it.",
  visual: null,
};

function writtenFor(params: PlacementItemsParams) {
  return taskResult({
    skills: params.skills.map(() => ({
      quick: Array.from({ length: params.quickCount }, () => QUICK_ITEMS[params.quickFormat]),
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

function oneCoursePerSkill(keys: string[]): GoalSkillGraph {
  return {
    courses: keys.map((key) => ({ key, levels: ["beginner"], title: `Course ${key}` })),
    estimatedHours: 10,
    phases: [{ estimatedHours: 10, milestone: "Milestone", title: "Phase 1" }],
    skills: keys.map((key) => ({
      area: `Course ${key}`,
      course: key,
      description: key,
      estimatedLessons: 1,
      examWeight: null,
      key,
      level: "beginner",
      name: key,
      phase: 1,
      prerequisites: [],
      topics: [],
    })),
  };
}

describe(shortPlanPracticeWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generatePlacementItems).mockReset();
    vi.mocked(generatePlacementItems).mockImplementation(async (params) => writtenFor(params));
  });

  it("asks the bank's share of questions for every skill short of it", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2 });

    await expect(
      shortPlanPracticeWorkflow({
        analytics: context.analytics,
        goalId: goal.id,
        need: { questionsPerSkill: 6, skillIds },
      }),
    ).resolves.toStrictEqual({ status: "written" });

    expect(
      vi.mocked(generatePlacementItems).mock.calls.map(([params]) => params.quickCount),
    ).toStrictEqual([6, 6]);
  });
});

describe(prepareGraphPlacement, () => {
  it("starts the questions' own run with the graph's picks once the skills are saved, without waiting for it", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 3 });
    const keys = skillIds.map((_, index) => `skill-${index}`);

    await prepareGraphPlacement({
      context,
      everySkill: false,
      goalId: goal.id,
      graph: oneCoursePerSkill(keys),
      knownAreas: [],
      ownLevel: null,
      skillIds: Promise.resolve(
        Object.fromEntries(skillIds.map((id, index) => [keys[index]!, id])),
      ),
      waitsForNotice: false,
    });

    expect(start).toHaveBeenCalledWith(placementItemsWorkflow, [
      {
        analytics: context.analytics,
        goalId: goal.id,
        skillIds: expect.arrayContaining(skillIds),
        waitsForNotice: false,
      },
    ]);

    expect(generatePlacementItems).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toStrictEqual([
      expect.objectContaining({ status: "started", step: "preparePlacement" }),
    ]);
  });
});

describe(placementItemsWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generatePlacementItems).mockReset();
    vi.mocked(generatePlacementItems).mockImplementation(async (params) => writtenFor(params));

    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        ({ data: { subjects: subjects.map(() => ({ terms: [] })) } }) as never,
    );
  });

  it("asks a question about a figure once its picture is drawn, and checks the picture in the background", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 1 });
    const figure = { alt: "A cell with its nucleus labeled.", prompt: `A cell ${randomUUID()}` };

    vi.mocked(generatePlacementItems).mockImplementation(async (params) =>
      taskResult({
        skills: params.skills.map(() => ({
          quick: [
            {
              ...QUICK_ITEMS.multipleChoice,
              context: "In the figure, an arrow points at the nucleus.",
              image: figure,
            },
          ],
          typed: [],
        })),
      }),
    );

    vi.mocked(generateImageScene).mockImplementation(({ request }) =>
      Promise.resolve({ data: sceneFor(request) } as never),
    );

    vi.mocked(generateLessonImage).mockResolvedValue({
      data: { image: { mediaType: "image/webp", uint8Array: TEST_IMAGE } },
      prompt: "test prompt",
      provenance: imageProvenance,
    } as never);

    vi.mocked(uploadImage).mockImplementation(({ fileName }) =>
      Promise.resolve({ data: `https://blob.test/${fileName}-${randomUUID()}`, error: null }),
    );

    await expect(
      placementItemsWorkflow({ analytics: context.analytics, goalId: goal.id, skillIds }),
    ).resolves.toMatchObject({ failed: 0, written: 1 });

    const item = await prisma.item.findFirstOrThrow({
      where: { format: "multipleChoice", skillId: { in: skillIds } },
    });

    expect(item.mediaAssetId).toStrictEqual(expect.any(String));
    expect(checkLessonImage).not.toHaveBeenCalled();

    expect(start).toHaveBeenCalledWith(pictureChecksWorkflow, [
      {
        analytics: expect.objectContaining({ distinctId: "learner" }),
        assetIds: [item.mediaAssetId],
      },
    ]);
  });

  it("writes the picked skills a few per call, with the quick questions that confirm a right pick", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 7 });

    await expect(
      placementItemsWorkflow({ analytics: context.analytics, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, status: "written", written: 7 });

    expect(calledSkillCounts()).toStrictEqual([1, 2, 2, 2]);

    expect(vi.mocked(generatePlacementItems).mock.calls[0]?.[0]).toMatchObject({
      examFormat: null,
      quickCount: 2,
      quickFormat: "multipleChoice",
      typedCount: 0,
    });

    expect(
      vi.mocked(generatePlacementItems).mock.calls.map(([params]) => params.serviceTier),
    ).toStrictEqual([undefined, undefined, undefined, undefined]);

    await expect(countItems({ format: "multipleChoice", skillIds })).resolves.toBe(14);
    await expect(countItems({ format: "typed", skillIds })).resolves.toBe(0);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ placementPreparedAt: expect.any(Date) });

    expect(trackServerEvent).not.toHaveBeenCalled();
  });

  it("writes no placement questions for a learner who skipped placement, and still writes a test-out's", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 3 });

    await prisma.goal.update({ data: { details: { level: "none" } }, where: { id: goal.id } });

    await expect(
      placementItemsWorkflow({ analytics: context.analytics, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, status: "written", written: 0 });

    expect(generatePlacementItems).not.toHaveBeenCalled();

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ placementPreparedAt: expect.any(Date) });

    await preparePlacementItems({
      ...context,
      formats: ["multipleChoice"],
      goalId: goal.id,
      skillIds,
    });

    expect(calledSkillCounts().reduce((sum, count) => sum + count, 0)).toBe(3);
  });

  it("writes no placement questions for a learner who chose where to start in the catalog", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2 });

    await prisma.goal.update({
      data: { details: { courseStart: { chapterId: randomUUID() }, level: "basic" } },
      where: { id: goal.id },
    });

    await expect(
      placementItemsWorkflow({ analytics: context.analytics, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, status: "written", written: 0 });

    expect(generatePlacementItems).not.toHaveBeenCalled();
  });

  it("then starts a class test's practice, sized to its days, and nothing for a longer plan", async () => {
    // A test run across midnight still stays two days away.
    vi.useFakeTimers({ toFake: ["Date"] });

    onTestFinished(() => {
      vi.useRealTimers();
    });

    const user = await userFixture();
    const skills = await Promise.all([skillFixture(), skillFixture()]);
    const inTwoDays = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    inTwoDays.setUTCDate(inTwoDays.getUTCDate() + 2);

    const goal = await goalFixture({
      dailyMinutes: 30,
      kind: "exam",
      targetDate: inTwoDays,
      timezone: "UTC",
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Células" }],
        skills: skills.map((skill) => ({
          area: "Biologia",
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
        })),
      },
    });

    const skillIds = skills.map((skill) => skill.id);
    const longer = await goalWithSkills({ count: 2 });
    vi.mocked(start).mockClear();

    await placementItemsWorkflow({ analytics: context.analytics, goalId: goal.id, skillIds });

    await placementItemsWorkflow({
      analytics: context.analytics,
      goalId: longer.goal.id,
      skillIds: longer.skillIds,
    });

    expect(vi.mocked(start).mock.calls).toStrictEqual([
      [
        shortPlanPracticeWorkflow,
        [
          {
            analytics: context.analytics,
            goalId: goal.id,
            need: { questionsPerSkill: 8, skillIds },
          },
        ],
      ],
    ]);
  });

  it("waits for a language exam's blueprint, not only its formats, so listening skills get no text questions", async () => {
    const { blueprint, goal, listeningSkills, reading } = await listeningGoalFixture();
    const listeningIds = listeningSkills.map((skill) => skill.id);

    const { sleep } = await import("workflow");

    await prisma.goal.update({
      data: {
        details: { noticeFormats: MULTIPLE_CHOICE_STRUCTURE.formats },
        examBlueprintId: null,
      },
      where: { id: goal.id },
    });

    vi.mocked(sleep)
      .mockResolvedValueOnce()
      .mockImplementationOnce(async () => {
        await prisma.goal.update({
          data: { examBlueprintId: blueprint.id },
          where: { id: goal.id },
        });
      });

    await placementItemsWorkflow({
      analytics: context.analytics,
      goalId: goal.id,
      skillIds: [reading.id, ...listeningIds],
      waitsForNotice: true,
    });

    await expect(
      Promise.all([
        countItems({ format: "multipleChoice", skillIds: [reading.id] }),
        countItems({ format: "multipleChoice", skillIds: listeningIds }),
      ]),
    ).resolves.toStrictEqual([1, 0]);
  });

  it("joins the run already writing the goal's questions", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2 });
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "other-run" });

    await expect(
      placementItemsWorkflow({ analytics: context.analytics, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, status: "joined", written: 0 });

    expect(generatePlacementItems).not.toHaveBeenCalled();
  });

  it("leaves a failed call to the runtime's retry of its own step, and counts the skills of one that keeps failing", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2 });
    const failing = await skillFixture({ name: `Always fails ${randomUUID()}` });
    const unavailable = new Error("Provider unavailable");

    vi.mocked(generatePlacementItems).mockImplementation(async (params) => {
      if (params.skills.some((skill) => skill.name === failing.name)) {
        throw unavailable;
      }

      return writtenFor(params);
    });

    const request = { ...context, goalId: goal.id, skillIds: [...skillIds, failing.id] };

    await expect(preparePlacementItems(request)).resolves.toStrictEqual({ failed: 2, written: 1 });

    expect(calledSkillCounts()).toStrictEqual([1, 2]);

    const { batches, quickFormat } = await pickPlacementBatchesStep({
      ...request,
      skillIds: [failing.id],
    });

    await expect(
      writePlacementBatchStep({ ...context, quickCount: 1, quickFormat, skills: batches[0] ?? [] }),
    ).rejects.toBe(unavailable);
  });

  it("writes an exam's true/false questions under its blueprint once research has read its notice", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2, kind: "exam" });

    await preparePlacementItems({ ...context, forPlacement: true, goalId: goal.id, skillIds });

    const blueprint = await examBlueprintFixture({
      name: "Polícia Federal",
      role: "Agente",
      structure: CEBRASPE_STRUCTURE,
    });

    await prisma.goal.update({ data: { examBlueprintId: blueprint.id }, where: { id: goal.id } });
    vi.mocked(generatePlacementItems).mockClear();

    await expect(
      preparePlacementItems({ ...context, forPlacement: true, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, written: 2 });

    expect(vi.mocked(generatePlacementItems).mock.calls).toStrictEqual([
      [
        expect.objectContaining({
          examFormat: expect.objectContaining({ name: "Polícia Federal, Agente" }),
          quickCount: 3,
          quickFormat: "trueFalse",
          typedCount: 0,
        }),
      ],
      [expect.objectContaining({ quickCount: 3, quickFormat: "trueFalse", typedCount: 0 })],
    ]);

    expect(
      vi.mocked(generatePlacementItems).mock.calls.map(([params]) => params.serviceTier),
    ).toStrictEqual(["priority", undefined]);

    const examItems = await prisma.item.findMany({
      where: { examBlueprintId: blueprint.id, skillId: { in: skillIds } },
    });

    expect(examItems.map((item) => item.format)).toStrictEqual(
      Array.from({ length: 6 }, () => "trueFalse"),
    );

    vi.mocked(generatePlacementItems).mockClear();
    await preparePlacementItems({ ...context, forPlacement: true, goalId: goal.id, skillIds });
    expect(generatePlacementItems).not.toHaveBeenCalled();
  });

  it("writes a new exam's first questions in the formats a first pass over its notice read", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2, kind: "exam" });

    await prisma.goal.update({
      data: { details: { noticeFormats: CEBRASPE_STRUCTURE.formats } },
      where: { id: goal.id },
    });

    await expect(
      placementItemsWorkflow({
        analytics: context.analytics,
        goalId: goal.id,
        skillIds,
        waitsForNotice: true,
      }),
    ).resolves.toMatchObject({ failed: 0, written: 2 });

    expect(vi.mocked(generatePlacementItems).mock.calls[0]?.[0]).toMatchObject({
      examFormat: { blueprintId: null, style: expect.stringContaining("Itens Certo ou Errado.") },
      quickFormat: "trueFalse",
      serviceTier: "priority",
    });

    await expect(countItems({ format: "multipleChoice", skillIds })).resolves.toBe(0);
    await expect(countItems({ format: "trueFalse", skillIds })).resolves.toBe(6);
  });

  it("waits for a new notice's formats before writing questions, and goes on without them in the end", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 1, kind: "exam" });
    const { sleep } = await import("workflow");

    await expect(
      placementItemsWorkflow({
        analytics: context.analytics,
        goalId: goal.id,
        skillIds,
        waitsForNotice: true,
      }),
    ).resolves.toMatchObject({ written: 1 });

    expect(sleep).toHaveBeenCalledTimes(39);

    expect(vi.mocked(generatePlacementItems).mock.calls[0]?.[0]).toMatchObject({
      examFormat: null,
      quickFormat: "multipleChoice",
    });
  });

  it("writes a multiple-choice exam's own questions once when its notice lands", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2, kind: "exam" });
    await preparePlacementItems({ ...context, goalId: goal.id, skillIds });

    const blueprint = await examBlueprintFixture({
      name: "ENEM",
      structure: MULTIPLE_CHOICE_STRUCTURE,
    });

    await prisma.goal.update({ data: { examBlueprintId: blueprint.id }, where: { id: goal.id } });
    vi.mocked(generatePlacementItems).mockClear();

    await expect(
      preparePlacementItems({ ...context, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, written: 2 });

    expect(vi.mocked(generatePlacementItems).mock.calls).toStrictEqual([
      [expect.objectContaining({ examFormat: expect.objectContaining({ name: "ENEM" }) })],
      [expect.objectContaining({ examFormat: expect.objectContaining({ name: "ENEM" }) })],
    ]);

    vi.mocked(generatePlacementItems).mockClear();
    await preparePlacementItems({ ...context, goalId: goal.id, skillIds });
    expect(generatePlacementItems).not.toHaveBeenCalled();
  });
});
