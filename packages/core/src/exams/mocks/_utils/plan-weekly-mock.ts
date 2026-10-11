import "server-only";
import { type Goal } from "@zoonk/db";
import { MIN_CHECKPOINT_QUESTIONS } from "../../../checkpoints/checkpoint-rules";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { isInFinalStretch } from "../../final-stretch/final-stretch-rules";
import { loadFinalStretchStart } from "../../final-stretch/load-final-stretch-start";
import { toSubjectCandidates } from "../mock-option-plan";
import { getSubjectShares } from "../mock-options";
import { type MockPlan, countPlannedQuestions, planMock } from "../mock-plan";
import { type MockEssayCandidate } from "../written-parts";
import { loadMockCandidates } from "./mock-candidates";
import { loadMockEssays } from "./mock-essays";
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
 * Plans the goal's weekly mock: one exam day in real conditions, half of it on regular weeks and
 * all of it in the final stretch, its written part included (the exam's own essays), from
 * questions the learner has never seen. With `itemIds`, it rebuilds the sections of a mock whose
 * questions were already picked.
 */
export async function planWeeklyMock({
  essays,
  goal,
  itemIds = null,
  skillIds,
  structure,
  today,
  userId,
}: {
  /** The exam's essays for a full mock's written part, when the caller loaded them already. */
  essays?: readonly MockEssayCandidate[];
  /** A goal deleted since keeps its mock, without areas or a date. */
  goal: Pick<Goal, "examBlueprintId" | "targetDate"> & { id: string | null };
  itemIds?: readonly string[] | null;
  skillIds: readonly string[];
  structure: ExamStructure | null;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
  userId: string;
}): Promise<MockPlan> {
  const [candidates, mockNumber, finalStretchStart, written] = await Promise.all([
    loadMockCandidates({ goal, itemIds, skillIds, structure, userId }),
    countFinishedMocksBefore({ goalId: goal.id }),
    loadFinalStretchStart(goal.id),
    essays ?? loadWeeklyMockEssays({ goal, userId }),
  ]);

  const bySubject = toSubjectCandidates({ candidates, structure });
  const fullLength = isInFinalStretch({ finalStretchStart, targetDate: goal.targetDate, today });

  const plan = (offset: number) =>
    planMock({
      adaptive: structure?.mock?.adaptive ?? false,
      candidates: bySubject,
      essays: written,
      fullLength,
      mockNumber: mockNumber + offset,
      structure,
      subjectShares: getSubjectShares(structure),
    });

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
