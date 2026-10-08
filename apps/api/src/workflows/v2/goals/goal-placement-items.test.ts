import { randomUUID } from "node:crypto";
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
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { mockHookConflict } from "../../../../mocks/workflow";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { taskResult } from "../_test-utils/recorded-outputs";
import { TEST_IMAGE, imageProvenance, sceneFor } from "../images/_test-utils/image-results";
import { pictureChecksWorkflow } from "../images/picture-checks-workflow";
import { prepareGraphPlacement } from "./goal-placement-items";
import { placementItemsWorkflow } from "./placement-items-workflow";
import { shortPlanPracticeWorkflow } from "./short-plan-practice-workflow";
import { preparePlacementItemsStep } from "./steps/goal-lookahead-steps";

vi.mock("workflow/api", () => ({ start: vi.fn(() => Promise.resolve({ runId: "started-run" })) }));

// Writing questions is a paid model call.
vi.mock("@zoonk/ai/tasks/v2/items/placement-items", () => ({ generatePlacementItems: vi.fn() }));

// Drawing a question's picture is a paid model call too, and its file goes to Vercel Blob.
vi.mock("@zoonk/ai/tasks/v2/images/check", () => ({ checkLessonImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/images/generate", () => ({ generateLessonImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/images/scene", () => ({ generateImageScene: vi.fn() }));
vi.mock("@zoonk/core/images/upload", () => ({ uploadImage: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({
  generateSearchTerms: vi.fn(async ({ subjects }: { subjects: unknown[] }) => ({
    data: { subjects: subjects.map(() => ({ terms: [] })) },
  })),
}));

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

/** A multiple-choice notice that doesn't say how many options, so the writer's two-option fakes pass. */
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

    // Only the skills' ids: their courses and prerequisites may still be on their way.
    await prepareGraphPlacement({
      context,
      everySkill: false,
      goalId: goal.id,
      graph: oneCoursePerSkill(keys),
      knownAreas: [],
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

    // Its wait opens here; the run writes the questions, so nothing was written yet.
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

    // The question is stored with its picture before any model looked at it; the check follows.
    expect(item.mediaAssetId).toStrictEqual(expect.any(String));
    expect(checkLessonImage).not.toHaveBeenCalled();

    expect(start).toHaveBeenCalledWith(pictureChecksWorkflow, [
      {
        analytics: expect.objectContaining({ distinctId: "learner" }),
        assetIds: [item.mediaAssetId],
      },
    ]);
  });

  it("writes the picked skills a few per call, with a quick and a typed question each", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 7 });

    await expect(
      placementItemsWorkflow({ analytics: context.analytics, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, status: "written", written: 7 });

    // Seven skills in four calls instead of fourteen, at the standard tier: a learn goal's
    // questions may serve one learner, so its first question gets no premium either.
    expect(calledSkillCounts()).toStrictEqual([1, 2, 2, 2]);

    expect(vi.mocked(generatePlacementItems).mock.calls[0]?.[0]).toMatchObject({
      examFormat: null,
      quickCount: 1,
      quickFormat: "multipleChoice",
      typedCount: 1,
    });

    expect(
      vi.mocked(generatePlacementItems).mock.calls.map(([params]) => params.serviceTier),
    ).toStrictEqual([undefined, undefined, undefined, undefined]);

    await expect(countItems({ format: "multipleChoice", skillIds })).resolves.toBe(7);
    await expect(countItems({ format: "typed", skillIds })).resolves.toBe(7);

    // Placement stops waiting for questions that didn't come once they're all written.
    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ placementPreparedAt: expect.any(Date) });

    expect(trackServerEvent).not.toHaveBeenCalled();
  });

  it("then starts a class test's practice, sized to its days, and nothing for a longer plan", async () => {
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

  it("joins the run already writing the goal's questions", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2 });
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "other-run" });

    await expect(
      placementItemsWorkflow({ analytics: context.analytics, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, status: "joined", written: 0 });

    expect(generatePlacementItems).not.toHaveBeenCalled();
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

    // The exam's own questions: its true/false ones and typed ones of its own, since placement
    // asks an exam its questions over the general ones written before.
    expect(vi.mocked(generatePlacementItems).mock.calls).toStrictEqual([
      [
        expect.objectContaining({
          examFormat: expect.objectContaining({ name: "Polícia Federal, Agente" }),
          quickFormat: "trueFalse",
          typedCount: 1,
        }),
      ],
      [expect.objectContaining({ quickFormat: "trueFalse", typedCount: 1 })],
    ]);

    // The exam's bank is very likely asked again: the first question the learner waits on is
    // written at the priority tier, the next ones, asked minutes later, at the standard one.
    expect(
      vi.mocked(generatePlacementItems).mock.calls.map(([params]) => params.serviceTier),
    ).toStrictEqual(["priority", undefined]);

    const examItems = await prisma.item.findMany({
      where: { examBlueprintId: blueprint.id, skillId: { in: skillIds } },
    });

    expect(examItems.map((item) => item.format).toSorted()).toStrictEqual([
      "trueFalse",
      "trueFalse",
      "typed",
      "typed",
    ]);

    // A later call finds them.
    vi.mocked(generatePlacementItems).mockClear();
    await preparePlacementItemsStep({ ...context, goalId: goal.id, skillIds });
    expect(generatePlacementItems).not.toHaveBeenCalled();
  });

  it("writes a new exam's first questions in the formats a first pass over its notice read", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2, kind: "exam" });

    // Research is still reading the notice: the goal knows only its formats.
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

    // Statements judged right or wrong, as the exam asks, never general multiple choice, and at
    // the priority tier: an exam's questions are very likely asked again.
    expect(vi.mocked(generatePlacementItems).mock.calls[0]?.[0]).toMatchObject({
      examFormat: { blueprintId: null, style: expect.stringContaining("Itens Certo ou Errado.") },
      quickFormat: "trueFalse",
      serviceTier: "priority",
    });

    await expect(countItems({ format: "multipleChoice", skillIds })).resolves.toBe(0);
    await expect(countItems({ format: "trueFalse", skillIds })).resolves.toBe(2);
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

    // Two minutes of polls, then the general format rather than no placement at all.
    expect(sleep).toHaveBeenCalledTimes(39);

    expect(vi.mocked(generatePlacementItems).mock.calls[0]?.[0]).toMatchObject({
      examFormat: null,
      quickFormat: "multipleChoice",
    });
  });

  it("writes a multiple-choice exam's own questions once when its notice lands", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2, kind: "exam" });
    await preparePlacementItemsStep({ ...context, goalId: goal.id, skillIds });

    const blueprint = await examBlueprintFixture({
      name: "ENEM",
      structure: MULTIPLE_CHOICE_STRUCTURE,
    });

    await prisma.goal.update({ data: { examBlueprintId: blueprint.id }, where: { id: goal.id } });
    vi.mocked(generatePlacementItems).mockClear();

    // The general questions written before the notice don't count: the exam's own are written.
    await expect(
      preparePlacementItemsStep({ ...context, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, written: 2 });

    expect(vi.mocked(generatePlacementItems).mock.calls).toStrictEqual([
      [expect.objectContaining({ examFormat: expect.objectContaining({ name: "ENEM" }) })],
      [expect.objectContaining({ examFormat: expect.objectContaining({ name: "ENEM" }) })],
    ]);

    // Once per exam: a later call, like the next learner of the exam, writes nothing.
    vi.mocked(generatePlacementItems).mockClear();
    await preparePlacementItemsStep({ ...context, goalId: goal.id, skillIds });
    expect(generatePlacementItems).not.toHaveBeenCalled();
  });
});
