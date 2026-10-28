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

/** The exam's essays a weekly mock may ask; none for a goal deleted since. */
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

/**
 * The recordings each listening section plays (`loadListeningCandidates`), the ones a mock whose
 * questions were picked already holds when it's rebuilt; none for a goal deleted since.
 */
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

/**
 * Plans the goal's weekly mock: one exam day in real conditions, half of it on regular weeks and
 * all of it in the final stretch, its written part included (the exam's own essays), from
 * questions the learner has never seen. With `itemIds`, it rebuilds the sections of a mock whose
 * questions were already picked. A scheduled mock (`identity`, as its plan saved it) sits its own
 * exam day and length, the ones its plan funded and shows: never another day by the bank or the
 * mocks finished, nor another length by the phase.
 */
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
  /** The exam's essays for a full mock's written part, when the caller loaded them already. */
  essays?: readonly MockEssayCandidate[];
  /** A goal deleted since keeps its mock, without areas or a date. */
  goal: Pick<Goal, "examBlueprintId" | "targetDate"> & { id: string | null };
  /** The scheduled mock's exam day and length, as its plan saved it (see `findScheduledMock`). */
  identity?: MockIdentity | null;
  itemIds?: readonly string[] | null;
  /** The saved plan a GET already read (`readSavedPlan`), so it isn't read again. */
  savedPlan?: SavedPlan;
  skillIds: readonly string[];
  structure: ExamStructure | null;
  /** The learner-local date, as a UTC-midnight label. */
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

  // A scheduled mock runs its real time limit, the one its plan funded, however few questions it has.
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

  // A scheduled mock sits its own exam day: the turn that's that day's.
  if (identity) {
    return plan(Math.max(0, getMockDays(structure).indexOf(identity.day)) - mockNumber);
  }

  const days = new Set((structure?.mock?.sections ?? []).map((section) => section.day)).size;
  const plans = Array.from({ length: Math.max(1, days) }, (_, offset) => plan(offset));

  const fullest = plans.reduce((best, candidate) =>
    countPlannedQuestions(candidate) > countPlannedQuestions(best) ? candidate : best,
  );

  // Rebuilding a mock whose questions were picked: the exam day whose sections hold the most of
  // them, which is the day it was planned for unless the goal's mocks moved on since.
  if (itemIds) {
    return fullest;
  }

  // The days take turns; a day whose areas the learner has no questions for yet waits its turn.
  return (
    plans.find((candidate) => countPlannedQuestions(candidate) >= MIN_CHECKPOINT_QUESTIONS) ??
    fullest
  );
}
