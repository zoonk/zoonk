import "server-only";
import { type Goal } from "@zoonk/db";
import { MIN_CHECKPOINT_QUESTIONS } from "../../../checkpoints/checkpoint-rules";
import { type SavedPlan } from "../../../learner/facts/saved-plan";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { type MockIdentity } from "../../../plans/planner/mock-identity";
import { parsePlanPhases } from "../../../plans/planner/plan-state";
import { getFinalStretchStart, isInFinalStretch } from "../../final-stretch/final-stretch-rules";
import { loadFinalStretchStart } from "../../final-stretch/load-final-stretch-start";
import { getMockFormatMix } from "../mock-format-mix";
import { toSubjectCandidates } from "../mock-option-plan";
import { getSubjectShares } from "../mock-options";
import {
  type MockCandidate,
  type MockPlan,
  countPlannedQuestions,
  getMockClock,
  getMockDays,
  planMock,
} from "../mock-plan";
import { type MockEssayCandidate } from "../written-parts";
import { loadMockCandidates } from "./mock-candidates";
import { loadMockEssays } from "./mock-essays";
import { loadListeningCandidates } from "./mock-listening";
import { countFinishedMocksBefore } from "./mock-number";

function loadWeeklyMockEssays({
  goal,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId"> & { id: string | null };
  userId: string;
}): Promise<MockEssayCandidate[]> {
  const { id } = goal;

  return id
    ? loadMockEssays({ goal: { examBlueprintId: goal.examBlueprintId, id }, userId })
    : Promise.resolve([]);
}

async function loadWeeklyMockListening({
  goalId,
  itemIds,
  structure,
  userId,
}: {
  goalId: string | null;
  itemIds: readonly string[] | null;
  structure: ExamStructure | null;
  userId: string;
}): Promise<Map<string, MockCandidate[]>> {
  if (!goalId) {
    return new Map();
  }

  const { recordings } = await loadListeningCandidates({
    goalId,
    mix: getMockFormatMix(structure),
    userId,
  });

  if (!itemIds) {
    return recordings;
  }

  const picked = new Set(itemIds);

  return new Map(
    [...recordings].flatMap(([name, candidates]) => {
      const kept = candidates.filter((candidate) => picked.has(candidate.itemId));
      return kept.length > 0 ? [[name, kept] as const] : [];
    }),
  );
}

export async function planWeeklyMock({
  essays,
  goal,
  identity = null,
  itemIds = null,
  savedPlan,
  skillIds,
  structure,
  today,
  userId,
}: {
  essays?: readonly MockEssayCandidate[];
  goal: Pick<Goal, "examBlueprintId" | "targetDate"> & { id: string | null };
  identity?: MockIdentity | null;
  itemIds?: readonly string[] | null;
  savedPlan?: SavedPlan;
  skillIds: readonly string[];
  structure: ExamStructure | null;
  today: Date;
  userId: string;
}): Promise<MockPlan> {
  const [candidates, mockNumber, finalStretchStart, written, listening] = await Promise.all([
    loadMockCandidates({ goal, itemIds, plan: savedPlan, skillIds, structure, userId }),
    countFinishedMocksBefore({ goalId: goal.id }),
    savedPlan
      ? getFinalStretchStart(parsePlanPhases(savedPlan.phases))
      : loadFinalStretchStart(goal.id),
    essays ?? loadWeeklyMockEssays({ goal, userId }),
    loadWeeklyMockListening({ goalId: goal.id, itemIds, structure, userId }),
  ]);

  const bySubject = toSubjectCandidates({ candidates, structure });

  const fullLength =
    identity?.fullLength ??
    isInFinalStretch({ finalStretchStart, targetDate: goal.targetDate, today });

  const clock = identity ? getMockClock({ ...identity, structure }) : undefined;

  const plan = (offset: number) =>
    planMock({
      adaptive: structure?.mock?.adaptive ?? false,
      candidates: bySubject,
      clock,
      essays: written,
      fullLength,
      listening,
      mockNumber: mockNumber + offset,
      structure,
      subjectShares: getSubjectShares(structure),
    });

  if (identity) {
    return plan(Math.max(0, getMockDays(structure).indexOf(identity.day)) - mockNumber);
  }

  const days = new Set((structure?.mock?.sections ?? []).map((section) => section.day)).size;
  const plans = Array.from({ length: Math.max(1, days) }, (_, offset) => plan(offset));

  const fullest = plans.reduce((best, candidate) =>
    countPlannedQuestions(candidate) > countPlannedQuestions(best) ? candidate : best,
  );

  if (itemIds) {
    return fullest;
  }

  return (
    plans.find((candidate) => countPlannedQuestions(candidate) >= MIN_CHECKPOINT_QUESTIONS) ??
    fullest
  );
}
