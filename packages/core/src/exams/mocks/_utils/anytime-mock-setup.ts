import "server-only";
import { type ExamBlueprint, type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { MIN_CHECKPOINT_QUESTIONS } from "../../../checkpoints/checkpoint-rules";
import { findExamSpeakingSetup } from "../../../language/exam-speaking/_utils/exam-speaking-setup";
import { GRADABLE_ITEM_FORMATS } from "../../../learner/_utils/choice-items";
import { loadGoalSkillIds } from "../../../learner/_utils/goal-skill-graph";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { getSkillArea } from "../../../plans/planner/graph-areas";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { loadExamChoices } from "../../choices/load-exam-choices";
import { type AnytimeMockChoice } from "../mock-contract";
import { getDaySections } from "../mock-day-sections";
import { getMockFormatMix } from "../mock-format-mix";
import { type MockOption, findMockOption, listMockOptions } from "../mock-options";
import { type MockCandidate, getMockDays } from "../mock-plan";
import { type MockSizeSource } from "../mock-view-contract";
import {
  type PlacementMockOption,
  type PlacementSkill,
  getRecommendedPlacementLength,
  listPlacementMockOptions,
} from "../placement-mock";
import { type MockEssayCandidate } from "../written-parts";
import { loadSkillAreas } from "./mock-candidates";
import { loadMockEssays } from "./mock-essays";
import { loadListeningCandidates } from "./mock-listening";
import { countFinishedMocksBefore } from "./mock-number";
import { loadMockPace } from "./mock-pace";
import { loadBankTypedParts } from "./mock-typed-parts";
import { readMockSizeSource, readMockStructure } from "./read-mock-structure";

/** An exam goal's mocks as they can be taken any time: the exam they copy and their options. */
export type AnytimeMockSetup = {
  blueprint: ExamBlueprint | null;
  /** The exam's essays, which a full mock's written parts ask. */
  essays: MockEssayCandidate[];
  examName: string;
  /** The plan's areas, which a mock's questions come from. */
  goalAreas: string[];
  /** The recordings each listening section plays, by its name (`loadListeningCandidates`). */
  listening: ReadonlyMap<string, readonly MockCandidate[]>;
  /** The listening sections a part of which has no recording yet, which a mock's start writes. */
  unvoiced: ReadonlySet<string>;
  options: MockOption[];
  /** A diagnostic mock's lengths, for placement in onboarding. */
  placement: PlacementMockOption[];
  /** Where the options' size comes from, to say beside them. */
  sizeSource: MockSizeSource;
  /** The goal's exam has a speaking paper, which its full mocks sit (`findExamSpeakingSetup`). */
  speaking: boolean;
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
  const [blueprint, areas, finished, pace, essays, choices, typed, speaking] = await Promise.all([
    goal.examBlueprintId
      ? prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : null,
    loadSkillAreas(goal.id),
    countFinishedMocksBefore({ goalId: goal.id }),
    loadMockPace(goal.examBlueprintId),
    loadMockEssays({ goal, userId: goal.userId }),
    loadExamChoices(goal.id),
    loadBankTypedParts(goal.examBlueprintId),
    findExamSpeakingSetup({ goalId: goal.id, userId: goal.userId }),
  ]);

  const buildable = await canBuildMock({ blueprint, skillIds: [...areas.keys()] });

  const structure = blueprint ? readMockStructure({ blueprint, choices }) : null;

  const { recordings, unvoiced } = await loadListeningCandidates({
    goalId: goal.id,
    mix: getMockFormatMix(structure),
    userId: goal.userId,
  });

  const days = getMockDays(structure);
  const goalAreas = [...new Set(areas.values())];

  return {
    blueprint,
    essays,
    examName: blueprint?.name ?? goal.title,
    goalAreas,
    listening: recordings,
    // A listening section without its recordings yet is still sat: the mock's start writes them.
    options: buildable
      ? listMockOptions({
          dayInTurn: days[finished % days.length] ?? null,
          essays,
          goalAreas,
          listening: new Set([...recordings.keys(), ...unvoiced]),
          pace,
          speaking: speaking !== null,
          structure,
          typed,
        })
      : [],
    placement: buildable ? listPlacementMockOptions({ goalAreas, pace, structure }) : [],
    sizeSource: readMockSizeSource(blueprint),
    speaking: speaking !== null,
    structure,
    unvoiced,
  };
}

/**
 * The listening sections a picked exam day (in full or half) sits whose recordings aren't voiced
 * yet: starting the mock writes them first (see `requestMockQuestions`). None for a subject's mock
 * or placement, which ask no recordings.
 */
export function listMissingRecordings({
  pick,
  setup,
}: {
  pick: AnytimeMockPick;
  setup: AnytimeMockSetup;
}): string[] {
  if (pick.purpose !== "practice" || pick.option.kind === "area" || setup.unvoiced.size === 0) {
    return [];
  }

  return getDaySections({
    day: pick.option.day,
    listening: setup.unvoiced,
    structure: setup.structure,
  })
    .filter((section) => section.kind === "listening")
    .flatMap((section) => section.name ?? []);
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
