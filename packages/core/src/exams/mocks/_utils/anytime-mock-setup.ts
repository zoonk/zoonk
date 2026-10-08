import "server-only";
import { type ExamBlueprint, type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { MIN_CHECKPOINT_QUESTIONS } from "../../../checkpoints/checkpoint-rules";
import { GRADABLE_ITEM_FORMATS } from "../../../learner/_utils/choice-items";
import { loadGoalSkillIds } from "../../../learner/_utils/goal-skill-graph";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { getSkillArea } from "../../../plans/planner/graph-areas";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { withClassTestMock } from "../class-test-mock";
import { type AnytimeMockChoice } from "../mock-contract";
import { type MockOption, findMockOption, listMockOptions } from "../mock-options";
import { getMockDays } from "../mock-plan";
import {
  type PlacementMockOption,
  type PlacementSkill,
  getRecommendedPlacementLength,
  listPlacementMockOptions,
} from "../placement-mock";
import { loadSkillAreas } from "./mock-candidates";
import { countFinishedMocksBefore } from "./mock-number";
import { loadMockPace } from "./mock-pace";

/** An exam goal's mocks as they can be taken any time: the exam they copy and their options. */
export type AnytimeMockSetup = {
  blueprint: ExamBlueprint | null;
  examName: string;
  /** The plan's areas, which a mock's questions come from. */
  goalAreas: string[];
  options: MockOption[];
  /** A diagnostic mock's lengths, for placement in onboarding. */
  placement: PlacementMockOption[];
  structure: ExamStructure | null;
};

/**
 * Whether a mock can be built: the exam's notice or the learner's material gives its format (the
 * bank's missing questions are written in it), or, without either (a class test with no material
 * yet), the shared bank already holds enough questions on the goal's skills.
 */
async function canBuildMock({
  blueprint,
  skillIds,
}: {
  blueprint: ExamBlueprint | null;
  skillIds: readonly string[];
}): Promise<boolean> {
  if (blueprint) {
    return true;
  }

  const questions = await prisma.item.count({
    where: {
      format: { in: [...GRADABLE_ITEM_FORMATS] },
      skillId: { in: [...skillIds] },
      ...getItemAudienceFilter({}),
    },
  });

  return questions >= MIN_CHECKPOINT_QUESTIONS;
}

/**
 * What an exam goal's mocks taken any time copy: its blueprint's structure (a class test's short
 * test included) and the options it gives, on the plan's areas, each with about how long it takes
 * at learners' real pace on the exam's mocks. The half mock copies the exam day whose turn it is,
 * as the weekly mocks take turns. None while no mock can be built (see `canBuildMock`).
 */
export async function loadAnytimeMockSetup(goal: Goal): Promise<AnytimeMockSetup> {
  const [blueprint, areas, finished, pace] = await Promise.all([
    goal.examBlueprintId
      ? prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : null,
    loadSkillAreas(goal.id),
    countFinishedMocksBefore({ goalId: goal.id }),
    loadMockPace(goal.examBlueprintId),
  ]);

  const buildable = await canBuildMock({ blueprint, skillIds: [...areas.keys()] });

  const structure = blueprint
    ? withClassTestMock({
        ownerId: blueprint.ownerId,
        structure: readBlueprintContent(blueprint).structure,
      })
    : null;

  const days = getMockDays(structure);
  const goalAreas = [...new Set(areas.values())];

  return {
    blueprint,
    examName: blueprint?.name ?? goal.title,
    goalAreas,
    options: buildable
      ? listMockOptions({
          dayInTurn: days[finished % days.length] ?? null,
          goalAreas,
          pace,
          structure,
        })
      : [],
    placement: buildable ? listPlacementMockOptions({ goalAreas, pace, structure }) : [],
    structure,
  };
}

/** The mock a learner asked for: one of the goal's options, or a diagnostic one as placement. */
export type AnytimeMockPick =
  | { option: MockOption; purpose: "practice" }
  | { option: PlacementMockOption; purpose: "placement" };

/**
 * The mock a learner asked for: a diagnostic one as placement, in the length picked (the
 * recommended one without), or one of the goal's options by its shape. Null when it isn't one of
 * them (the options moved on, or it was never one).
 */
export function resolveAnytimeOption({
  choice,
  setup,
}: {
  choice: AnytimeMockChoice;
  setup: AnytimeMockSetup;
}): AnytimeMockPick | null {
  if (choice.purpose === "placement") {
    const length = choice.length ?? getRecommendedPlacementLength(setup.placement);
    const option = setup.placement.find((candidate) => candidate.length === length);

    return option ? { option, purpose: "placement" } : null;
  }

  const option = choice.shape
    ? findMockOption({ options: setup.options, shape: choice.shape })
    : null;

  return option ? { option, purpose: "practice" } : null;
}

/** Mocks taken any time, by their stored purpose (a scheduled mock whose session is gone isn't one). */
const ANYTIME_MOCK_FILTER = {
  OR: (["practice", "placement"] as const).map((purpose) => ({
    conditions: { equals: purpose, path: ["purpose"] },
  })),
};

/** The goal's mock taken any time that's still running: one at a time. */
export function findRunningAnytimeMock({
  client = prisma,
  goalId,
  userId,
}: {
  client?: TransactionClient;
  goalId: string;
  userId: string;
}) {
  return client.mockExam.findFirst({
    orderBy: { startedAt: "desc" },
    where: { ...ANYTIME_MOCK_FILTER, blockId: null, goalId, status: "active", userId },
  });
}

/** The goal's mock taken as placement in onboarding, the latest one when there are several. */
export function findPlacementMock({ goalId, userId }: { goalId: string; userId: string }) {
  return prisma.mockExam.findFirst({
    orderBy: { startedAt: "desc" },
    where: {
      blockId: null,
      conditions: { equals: "placement", path: ["purpose"] },
      goalId,
      userId,
    },
  });
}

/**
 * The skills a mock taken any time asks about: the plan's graph's, which a goal in onboarding has
 * before its plan's lessons, and the finer ones its lessons teach.
 */
export async function loadMockSkillIds(goalId: string): Promise<string[]> {
  const [plan, lessonSkillIds] = await Promise.all([
    prisma.plan.findUnique({ select: { graph: true }, where: { goalId } }),
    loadGoalSkillIds(goalId),
  ]);

  const graphSkillIds = parsePlanGraph(plan?.graph).skills.map((skill) => skill.skillId);
  return [...new Set([...graphSkillIds, ...lessonSkillIds])];
}

/**
 * The plan's graph skills in its order (the basics first), each with its area: the topics a
 * diagnostic mock spreads its questions over. Empty while the plan is still being drawn.
 */
export async function loadPlacementSkills(goalId: string): Promise<PlacementSkill[]> {
  const plan = await prisma.plan.findUnique({ select: { graph: true }, where: { goalId } });
  const graph = parsePlanGraph(plan?.graph);

  return graph.skills.map((skill) => ({
    area: getSkillArea({ graph, skill }),
    skillId: skill.skillId,
  }));
}
