import "server-only";
import { type ExamBlueprint, type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { MIN_CHECKPOINT_QUESTIONS } from "../../../checkpoints/checkpoint-rules";
import { findExamSpeakingSetup } from "../../../language/exam-speaking/_utils/exam-speaking-setup";
import { GRADABLE_ITEM_FORMATS } from "../../../learner/_utils/choice-items";
import { loadGoalSkillIds } from "../../../learner/_utils/goal-skill-graph";
import { type SavedPlan } from "../../../learner/facts/saved-plan";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { getSkillArea } from "../../../plans/planner/graph-areas";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { readExamChoices } from "../../choices/exam-choices";
import { loadExamChoices } from "../../choices/load-exam-choices";
import { type AnytimeMockChoice } from "../mock-contract";
import { getDaySections } from "../mock-day-sections";
import { getMockFormatMix } from "../mock-format-mix";
import { type MockTypedPart } from "../mock-left-out";
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
import { hasStoredTimeRunOutAway } from "./owned-mock";
import { readMockSizeSource, readMockStructure } from "./read-mock-structure";

export type AnytimeMockSetup = {
  blueprint: ExamBlueprint | null;
  essays: MockEssayCandidate[];
  examName: string;
  goalAreas: string[];
  listening: ReadonlyMap<string, readonly MockCandidate[]>;
  unvoiced: ReadonlySet<string>;
  options: MockOption[];
  placement: PlacementMockOption[];
  sizeSource: MockSizeSource;
  speaking: boolean;
  structure: ExamStructure | null;
};

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

type AnytimeMockPage = {
  essays: Promise<MockEssayCandidate[]>;
  plan: Promise<SavedPlan | null>;
  typed: Promise<MockTypedPart[]>;
};

export async function loadAnytimeMockSetup(
  goal: Goal,
  knownBlueprint?: ExamBlueprint | null | Promise<ExamBlueprint | null>,
  page?: AnytimeMockPage,
): Promise<AnytimeMockSetup> {
  const plan = page ? await page.plan : undefined;

  const [blueprint, areas, finished, pace, essays, choices, typed, speaking] = await Promise.all([
    knownBlueprint === undefined && goal.examBlueprintId
      ? prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : (knownBlueprint ?? null),
    loadSkillAreas(goal.id, plan ?? undefined),
    countFinishedMocksBefore({ goalId: goal.id }),
    loadMockPace(goal.examBlueprintId),
    page?.essays ?? loadMockEssays({ goal, userId: goal.userId }),
    plan === undefined ? loadExamChoices(goal.id) : readExamChoices(plan?.settings),
    page?.typed ?? loadBankTypedParts(goal.examBlueprintId),
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

export type AnytimeMockPick =
  | { option: MockOption; purpose: "practice" }
  | { option: PlacementMockOption; purpose: "placement" };

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

const ANYTIME_MOCK_FILTER = {
  OR: (["practice", "placement"] as const).map((purpose) => ({
    conditions: { equals: purpose, path: ["purpose"] },
  })),
};

export async function findRunningAnytimeMock({
  client = prisma,
  goalId,
  now: requestInstant,
  userId,
}: {
  client?: TransactionClient;
  goalId: string;
  now?: Date | Promise<Date>;
  userId: string;
}) {
  const active = await client.mockExam.findMany({
    include: { answers: { select: { answer: true } } },
    orderBy: { startedAt: "desc" },
    where: { ...ANYTIME_MOCK_FILTER, blockId: null, goalId, status: "active", userId },
  });

  const instant = requestInstant === undefined ? undefined : await requestInstant;
  const now = instant?.getTime() ?? Date.now();
  return active.find((mock) => !hasStoredTimeRunOutAway({ mock, now })) ?? null;
}

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

export async function loadMockSkillIds(goalId: string): Promise<string[]> {
  const [plan, lessonSkillIds] = await Promise.all([
    prisma.plan.findUnique({ select: { graph: true }, where: { goalId } }),
    loadGoalSkillIds(goalId),
  ]);

  const graphSkillIds = parsePlanGraph(plan?.graph).skills.map((skill) => skill.skillId);
  return [...new Set([...graphSkillIds, ...lessonSkillIds])];
}

export async function loadPlacementSkills(goalId: string): Promise<PlacementSkill[]> {
  const plan = await prisma.plan.findUnique({ select: { graph: true }, where: { goalId } });
  const graph = parsePlanGraph(plan?.graph);

  return graph.skills.map((skill) => ({
    area: getSkillArea({ graph, skill }),
    skillId: skill.skillId,
  }));
}
