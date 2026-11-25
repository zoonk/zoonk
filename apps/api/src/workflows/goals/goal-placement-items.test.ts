import { randomUUID } from "node:crypto";
import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import { checkLessonImage } from "@zoonk/ai/tasks/images/check";
import { generateLessonImage } from "@zoonk/ai/tasks/images/generate";
import { generateImageScene } from "@zoonk/ai/tasks/images/scene";
import {
  type PlacementItemsParams,
  generatePlacementItems,
} from "@zoonk/ai/tasks/items/placement-items";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { solveItems } from "@zoonk/ai/tasks/items/solve";
import { trackServerEvent } from "@zoonk/core/analytics/server";
import { listFollowUps } from "@zoonk/core/follow-ups/rows";
import { uploadImage } from "@zoonk/core/images/upload";
import { answerPlacementQuestion } from "@zoonk/core/learner/placement/answer";
import { finishGoalPlacement } from "@zoonk/core/learner/placement/finish";
import { startPlacementSitting } from "@zoonk/core/learner/placement/sitting";
import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { listeningGoalFixture } from "@zoonk/testing/fixtures/listening";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { sleep } from "workflow";
import { start } from "workflow/api";
import { mockSession } from "../../../../../packages/core/src/_test-utils/mock-session";
import { learnerGoalFixture } from "../../../../../packages/core/src/learner/_test-utils/learner-goal";
import { lowGuessTapItems } from "../../../../../packages/core/src/learner/_test-utils/placement-tap-items";
import { mockHookConflict } from "../../../mocks/workflow";
import { getStreamedEvents } from "../_test-utils/parse-stream-events";
import { taskResult } from "../_test-utils/recorded-outputs";
import { solveAsKeyed } from "../_test-utils/solved-items";
import { getStartMock } from "../_test-utils/start-mock";
import { TEST_IMAGE, imageProvenance, sceneFor } from "../images/_test-utils/image-results";
import { pictureChecksWorkflow } from "../images/picture-checks-workflow";
import { preparePlanPlacement } from "./goal-placement-items";
import { preparePlacementItems } from "./placement-items";
import { placementItemsWorkflow } from "./placement-items-workflow";
import { shortPlanPracticeWorkflow } from "./short-plan-practice-workflow";
import { pickPlacementBatchesStep, writePlacementBatchStep } from "./steps/placement-items-steps";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

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
      {
        isCorrect: false,
        misconception: "Skips a step",
        reason: "It misses a step the rule requires.",
        text: "Incomplete",
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

const TAP_OPTION = { isCorrect: true, misconception: null, reason: "It fits the rule." };

const TAP_ITEMS: GeneratedItem[] = [
  {
    difficulty: "medium",
    format: "matchPairs",
    pairs: ["a", "b", "c", "d"].map((left) => ({ left, right: left.toUpperCase() })),
    question: "Match each case to its rule.",
    reason: "Each case follows its rule.",
  },
  {
    difficulty: "medium",
    format: "order",
    question: "Put the steps in order.",
    reason: "Each step needs the one before.",
    steps: ["First", "Second", "Third", "Fourth"],
  },
  {
    context: null,
    difficulty: "hard",
    fixedOrder: false,
    format: "multipleChoice",
    image: null,
    options: [
      { ...TAP_OPTION, text: "Fits one way" },
      { ...TAP_OPTION, text: "Fits another way" },
      ...["Breaks it", "Ignores it", "Reverses it"].map((text) => ({
        isCorrect: false,
        misconception: `${text} the rule`,
        reason: `It ${text.toLowerCase()}.`,
        text,
      })),
    ],
    question: "Which cases follow the rule?",
    visual: null,
  },
];

/** As the writer answers: only the lists a skill asked for, at its counts. */
function writtenFor(
  params: PlacementItemsParams,
  quick: (format: PlacementItemsParams["quickFormat"]) => readonly GeneratedItem[] = (format) => [
    QUICK_ITEMS[format],
  ],
) {
  return taskResult({
    skills: params.skills.map((skill) => ({
      quick:
        skill.quickCount > 0
          ? Array.from({ length: skill.quickCount }, () => quick(params.quickFormat)).flat()
          : [],
      taps: TAP_ITEMS.slice(0, skill.tapCount),
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
    courses: keys.map((key) => ({
      countrySpecific: false,
      key,
      levels: ["beginner"],
      title: `Course ${key}`,
    })),
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

    await shortPlanPracticeWorkflow({
      analytics: context.analytics,
      goalId: goal.id,
      need: { questionsPerSkill: 6, skillIds },
    });

    expect(
      vi
        .mocked(generatePlacementItems)
        .mock.calls.map(([params]) =>
          params.skills.map((skill) => [skill.quickCount, skill.tapCount]),
        ),
    ).toStrictEqual([[[6, 0]], [[6, 0]]]);
  });
});

describe(preparePlanPlacement, () => {
  it("picks from answers saved after the graph gate opened", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 4, kind: "exam" });
    const keys = skillIds.map((_, index) => `skill-${index}`);
    const initial = oneCoursePerSkill(keys);

    const graph = {
      ...initial,
      courses: initial.courses.slice(0, 1),
      skills: initial.skills.map((skill) => ({ ...skill, area: "Math", course: keys[0]! })),
    };

    const idsByKey = Object.fromEntries(skillIds.map((id, index) => [keys[index]!, id]));

    await prisma.plan.update({
      data: { graph: toGoalPlanGraph({ courseIdsByKey: {}, graph, idsByKey }) },
      where: { goalId: goal.id },
    });

    await prisma.goal.update({ data: { details: { level: "basic" } }, where: { id: goal.id } });

    await preparePlanPlacement({ context, goalId: goal.id, waitsForNotice: false });

    const [input] = getStartMock().mock.calls.find(
      ([workflow]) => workflow === placementItemsWorkflow,
    )![1];

    vi.mocked(generatePlacementItems).mockImplementation(async (params) => writtenFor(params));
    await placementItemsWorkflow(input as Parameters<typeof placementItemsWorkflow>[0]);

    const picked = await prisma.item.findMany({ where: { skillId: { in: skillIds } } });

    expect(
      [...new Set(picked.map((item) => item.skillId))].toSorted((a, b) => a!.localeCompare(b!)),
    ).toStrictEqual(
      [skillIds[0], skillIds[2], skillIds[3]].toSorted((a, b) => a!.localeCompare(b!)),
    );
  });

  it("starts the questions' own run after the plan commits, without capturing its answers", async () => {
    const { goal } = await goalWithSkills({ count: 3 });

    await preparePlanPlacement({ context, goalId: goal.id, waitsForNotice: false });

    expect(start).toHaveBeenCalledWith(
      placementItemsWorkflow,
      [{ analytics: context.analytics, goalId: goal.id, waitsForNotice: false }],
      { experimental_hook: { token: `placement-items:${goal.id}` } },
    );

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
      writtenFor(params, () => [
        {
          ...QUICK_ITEMS.multipleChoice,
          context: "In the figure, an arrow points at the nucleus.",
          image: figure,
        },
      ]),
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
      where: { format: "multipleChoice", mediaAssetId: { not: null }, skillId: { in: skillIds } },
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

  it("never stores a quick question whose key a blind solve doesn't reach, and keeps the one written beside it", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 1 });

    const noRightOption = {
      ...QUICK_ITEMS.multipleChoice,
      question: `Which answer is right? ${randomUUID()}`,
    };

    vi.mocked(generatePlacementItems).mockImplementation(async (params) =>
      writtenFor(
        { ...params, skills: params.skills.map((skill) => ({ ...skill, tapCount: 0 })) },
        () => [noRightOption, QUICK_ITEMS.multipleChoice],
      ),
    );

    vi.mocked(solveItems).mockImplementation(async ({ items }) =>
      taskResult({
        solutions: items.map((item) =>
          item.format === "multipleChoice" && item.question === noRightOption.question
            ? { format: "multipleChoice" as const, picks: [], work: "No option is right." }
            : solveAsKeyed(item),
        ),
      }),
    );

    await expect(
      placementItemsWorkflow({ analytics: context.analytics, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, status: "written", written: 1 });

    await expect(
      prisma.item.findMany({ select: { content: true }, where: { skillId: { in: skillIds } } }),
    ).resolves.toStrictEqual([
      { content: expect.objectContaining({ question: QUICK_ITEMS.multipleChoice.question }) },
    ]);
  });

  it("replaces the answered quick question on a Quick retake and reuses the remaining bank", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 1,
      phases: [1],
      userId: user.id,
    });

    await lowGuessTapItems(skills[0]!.id);
    mockSession(user.id);

    const open = () => startPlacementSitting({ goalId: goal.id, input: { length: "quick" } });
    const first = await open();

    if (first.status !== "ready" || !first.placement.attempt || !first.placement.next) {
      throw new Error("Expected a first Quick question");
    }

    const attemptId = first.placement.attempt.id;
    const itemId = first.placement.next.itemId;

    await expect(
      answerPlacementQuestion({
        goalId: goal.id,
        input: { answer: { dontKnow: true }, attemptId, durationMs: 1000, itemId },
      }),
    ).resolves.toMatchObject({ isCorrect: false });

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { attemptId } }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(open()).resolves.toMatchObject({
      placement: { next: null, status: "waitingForQuestions" },
    });

    const followUps = await listFollowUps(user.id);
    const owed = followUps.find((row) => row.kind === "preparePlacementItems");

    if (!owed) {
      throw new Error("Expected the retake to request questions");
    }

    await placementItemsWorkflow(owed.input);

    await expect(open()).resolves.toMatchObject({
      placement: {
        next: {
          format: "multipleChoice",
          itemId: expect.not.stringMatching(itemId),
          skillId: skills[0]!.id,
        },
      },
    });

    await placementItemsWorkflow(owed.input);

    expect(
      vi.mocked(generatePlacementItems).mock.calls.map(([params]) => params.skills),
    ).toMatchObject([[{ quickCount: 1, tapCount: 0 }]]);
  });

  it("writes each picked skill's quick and tap questions, the first pick's in two calls at the learner's wait", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 7 });

    await expect(
      placementItemsWorkflow({ analytics: context.analytics, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, status: "written", written: 7 });

    const calls = vi.mocked(generatePlacementItems).mock.calls.map(([params]) => params);

    // The batches run side by side, so their calls land in any order.
    const writes = calls
      .map((params) => {
        const [skill] = params.skills;
        return `${params.skills.length}:${skill?.quickCount}:${skill?.tapCount}:${params.serviceTier ?? "soon"}`;
      })
      .toSorted((first, second) => first.localeCompare(second));

    expect(writes).toStrictEqual([
      "1:0:3:priority",
      "1:1:0:priority",
      ...Array.from({ length: 6 }, () => "1:1:3:soon"),
    ]);

    expect(calls.every((params) => params.examFormat === null)).toBe(true);
    expect(calls.every((params) => params.quickFormat === "multipleChoice")).toBe(true);

    const firstPick = calls.filter((params) => params.serviceTier === "priority");
    expect(new Set(firstPick.map((params) => params.skills[0]?.name)).size).toBe(1);

    const solveTiers = vi
      .mocked(solveItems)
      .mock.calls.map(([params]) => [params.select ?? 1, params.serviceTier]);

    expect(
      solveTiers
        .filter(([, tier]) => tier === "priority")
        .map(([select]) => String(select))
        .toSorted((first, second) => first.localeCompare(second)),
    ).toStrictEqual(["1", "all"]);

    expect(solveTiers).toHaveLength(14);

    await expect(
      Promise.all(
        (["multipleChoice", "matchPairs", "order", "typed"] as const).map((format) =>
          countItems({ format, skillIds }),
        ),
      ),
    ).resolves.toStrictEqual([14, 7, 7, 0]);

    await expect(
      prisma.item.count({
        where: { content: { equals: "all", path: ["select"] }, skillId: { in: skillIds } },
      }),
    ).resolves.toBe(7);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ placementPreparedAt: expect.any(Date) });

    expect(trackServerEvent).not.toHaveBeenCalled();
  });

  it("never stores a tap question a guess passes too often", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 1 });
    const [pairs, order, selectAll] = TAP_ITEMS as [GeneratedItem, GeneratedItem, GeneratedItem];

    const fewPairs = {
      ...pairs,
      pairs: [
        { left: "a", right: "A" },
        { left: "b", right: "B" },
        { left: "c", right: "C" },
      ],
    };

    const fewOptions =
      selectAll.format === "multipleChoice"
        ? { ...selectAll, options: selectAll.options.slice(0, 4) }
        : selectAll;

    vi.mocked(generatePlacementItems).mockImplementation(async (params) =>
      taskResult({
        skills: params.skills.map((skill) => ({
          quick: skill.quickCount > 0 ? [QUICK_ITEMS.multipleChoice] : [],
          taps: skill.tapCount > 0 ? [fewPairs, order, fewOptions] : [],
        })),
      }),
    );

    await placementItemsWorkflow({ analytics: context.analytics, goalId: goal.id, skillIds });

    await expect(
      prisma.item.findMany({ select: { format: true }, where: { skillId: { in: skillIds } } }),
    ).resolves.toStrictEqual(
      expect.arrayContaining([{ format: "multipleChoice" }, { format: "order" }]),
    );

    await expect(prisma.item.count({ where: { skillId: { in: skillIds } } })).resolves.toBe(2);
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
        { experimental_hook: { token: `short-plan-practice:${goal.id}` } },
      ],
    ]);
  });

  it("waits for a language exam's blueprint, so listening skills get no text questions", async () => {
    const { blueprint, goal, listeningSkills, reading } = await listeningGoalFixture();
    const listeningIds = listeningSkills.map((skill) => skill.id);

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
        prisma.item.count({ where: { skillId: { in: listeningIds } } }),
      ]),
    ).resolves.toStrictEqual([2, 0]);
  });

  it("waits for earlier placement writing, then picks from the latest answer", async () => {
    const { goal, skillIds } = await goalWithSkills({ count: 2 });
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "other-run" });

    vi.mocked(sleep).mockImplementationOnce(async () => {
      expect(generatePlacementItems).not.toHaveBeenCalled();
      await prisma.goal.update({ data: { details: { level: "none" } }, where: { id: goal.id } });
      mockHookConflict(null);
    });

    await expect(
      placementItemsWorkflow({ analytics: context.analytics, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, status: "written", written: 0 });

    expect(sleep).toHaveBeenCalledExactlyOnceWith("10s");
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
      writePlacementBatchStep({ ...context, quickFormat, skills: batches[0] ?? [] }),
    ).rejects.toBe(unavailable);
  });

  it("keeps an exam's placement questions general, written once whatever its notice says", async () => {
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

    expect(sleep).not.toHaveBeenCalled();

    expect(
      vi
        .mocked(generatePlacementItems)
        .mock.calls.every(
          ([params]) => params.examFormat === null && params.quickFormat === "multipleChoice",
        ),
    ).toBe(true);

    const blueprint = await examBlueprintFixture({
      name: "Polícia Federal",
      role: "Agente",
      structure: CEBRASPE_STRUCTURE,
    });

    await prisma.goal.update({ data: { examBlueprintId: blueprint.id }, where: { id: goal.id } });
    vi.mocked(generatePlacementItems).mockClear();

    await expect(
      preparePlacementItems({ ...context, forPlacement: true, goalId: goal.id, skillIds }),
    ).resolves.toStrictEqual({ failed: 0, written: 0 });

    expect(generatePlacementItems).not.toHaveBeenCalled();

    await expect(
      prisma.item.count({ where: { examBlueprintId: { not: null }, skillId: { in: skillIds } } }),
    ).resolves.toBe(0);

    await expect(countItems({ format: "trueFalse", skillIds })).resolves.toBe(0);
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
