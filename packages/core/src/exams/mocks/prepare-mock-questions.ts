import "server-only";
import { prisma } from "@zoonk/db";
import {
  type PlacementQuickFormat,
  getPlacementQuickFormat,
} from "../../learner/placement/placement-quick-format";
import { listPastQuestionExamples } from "../../library/items/past-question-examples";
import { type PlacementItemSkill, toItemExam } from "../../lookahead/placement-item-skills";
import { loadAnytimeMockSetup } from "./_utils/anytime-mock-setup";
import { planMockWrites } from "./_utils/mock-writes";
import { type MockFormatShortfall } from "./mock-shortfall";

/** What a mock needs written: each format's shortfall, the exam's one-pick one in `quickFormat`. */
export type MockQuestionWrites = {
  quickFormat: PlacementQuickFormat;
  writes: MockFormatShortfall[];
};

/**
 * The days' writes as one: each skill of a format gets the most any day asks of it, and skills
 * lacking as many in a format share one write.
 */
function mergeWrites(writes: readonly MockFormatShortfall[]): MockFormatShortfall[] {
  const bySkill = new Map(
    writes
      .flatMap((write) => write.skillIds.map((skillId) => ({ skillId, write })))
      .toSorted((first, second) => first.write.target - second.write.target)
      .map((entry) => [`${entry.write.format.key}:${entry.skillId}`, entry] as const),
  );

  const groups = Map.groupBy(
    bySkill.values(),
    ({ write }) => `${write.format.key}:${write.questionsPerSkill}:${write.target}`,
  );

  return [...groups.values()].flatMap((entries) => {
    const [first] = entries;
    return first ? [{ ...first.write, skillIds: entries.map((entry) => entry.skillId) }] : [];
  });
}

/**
 * Whether another learner set up a goal for the exam before this one: its full mocks were
 * prepared then, so the exam pays for them once, and a later learner's mock writes only what's
 * still missing when it starts. Guests never prepare them, so theirs don't count.
 */
async function hasEarlierLearner({
  createdAt,
  examBlueprintId,
  id,
}: {
  createdAt: Date;
  examBlueprintId: string | null;
  id: string;
}): Promise<boolean> {
  if (!examBlueprintId) {
    return false;
  }

  const earlier = await prisma.goal.findFirst({
    select: { id: true },
    where: {
      createdAt: { lt: createdAt },
      examBlueprintId,
      id: { not: id },
      user: { isAnonymous: false },
    },
  });

  return earlier !== null;
}

/**
 * What an exam goal's full mocks still need written when the exam's first learner sets up their
 * goal, format by format in the notice's mix: each exam day's full mock from the shared bank as it
 * is (`planMockWrites`), so the learner's first full mock, of any day, starts without waiting, and
 * every later learner of the exam finds them made. Nothing for other goals, for the exam's later
 * learners (`hasEarlierLearner`) or once the bank holds them.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function listMockPrepWrites({
  goalId,
}: {
  goalId: string;
}): Promise<MockQuestionWrites> {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (goal?.kind !== "exam" || (await hasEarlierLearner(goal))) {
    return { quickFormat: "multipleChoice", writes: [] };
  }

  const setup = await loadAnytimeMockSetup(goal);
  const fulls = setup.options.filter((option) => option.kind === "full");

  const writes = await Promise.all(
    fulls.map((option) =>
      planMockWrites({ goal, pick: { option, purpose: "practice" }, setup, userId: goal.userId }),
    ),
  );

  return {
    quickFormat: getPlacementQuickFormat(setup.structure),
    writes: mergeWrites(writes.flatMap((write) => write ?? [])),
  };
}

/**
 * The goal's skills as the item writer writes a mock's questions on them, in the exam's style
 * with a few of its quoted past questions to match. Skills that no longer exist are left out.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function loadMockWritingSkills({
  goalId,
  skillIds,
}: {
  goalId: string;
  skillIds: readonly string[];
}): Promise<PlacementItemSkill[]> {
  const [goal, rows] = await Promise.all([
    prisma.goal.findUnique({ select: { examBlueprint: true }, where: { id: goalId } }),
    prisma.skill.findMany({
      select: {
        description: true,
        id: true,
        language: true,
        level: true,
        name: true,
        ownerId: true,
        targetLanguage: true,
      },
      where: { id: { in: [...skillIds] } },
    }),
  ]);

  const blueprint = goal?.examBlueprint ?? null;
  const exam = blueprint ? toItemExam(blueprint) : null;

  return Promise.all(
    skillIds
      .flatMap((id) => rows.find((row) => row.id === id) ?? [])
      .map(async (skill) => {
        const pastQuestions = blueprint
          ? await listPastQuestionExamples({ examBlueprintId: blueprint.id, skillIds: [skill.id] })
          : [];

        return { ...skill, exam: exam && { ...exam, pastQuestions }, usedSituations: [] };
      }),
  );
}
