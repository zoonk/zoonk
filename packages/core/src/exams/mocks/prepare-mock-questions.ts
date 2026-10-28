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

export type MockQuestionWrites = {
  quickFormat: PlacementQuickFormat;
  writes: MockFormatShortfall[];
};

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

/** Internal workflow bridge: the goal must come from the public boundary that created it. */
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

/** Internal workflow bridge: the goal must come from the public boundary that created it. */
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
