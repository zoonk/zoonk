import "server-only";
import { type Goal } from "@zoonk/db";
import { MIN_CHECKPOINT_QUESTIONS } from "../../../checkpoints/checkpoint-rules";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { isInFinalStretch } from "../../final-stretch/final-stretch-rules";
import { loadFinalStretchStart } from "../../final-stretch/load-final-stretch-start";
import { type ExamScale } from "../../scoring/exam-scales";
import { type MockScoring } from "../mock-contract";
import { toSubjectCandidates } from "../mock-option-plan";
import { getSubjectShares } from "../mock-options";
import { type MockPlan, countPlannedQuestions, planMock } from "../mock-plan";
import { loadMockCandidates } from "./mock-candidates";
import { countFinishedMocksBefore } from "./mock-number";

/**
 * How the exam is scored, from its blueprint; plain right answers when it doesn't say. Item
 * response theory scores land on ENEM's scale, so exams with a scale of their own (the SAT scores
 * with IRT too) count right answers and their estimate turns them into that scale.
 */
export function getMockScoring({
  scale,
  structure,
}: {
  scale: ExamScale | null;
  structure: ExamStructure | null;
}): MockScoring {
  const method = structure?.mock?.scoring.method;

  if (method === "itemResponseTheory" && !scale) {
    return "irt";
  }

  return method === "wrongCancelsRight" ? "net" : "raw";
}

/**
 * Plans the goal's weekly mock: one exam day in real conditions, half of it on regular weeks and
 * all of it in the final stretch, from questions the learner has never seen. With `itemIds`, it
 * rebuilds the sections of a mock whose questions were already picked.
 */
export async function planWeeklyMock({
  goal,
  itemIds = null,
  skillIds,
  structure,
  today,
  userId,
}: {
  /** A goal deleted since keeps its mock, without areas or a date. */
  goal: Pick<Goal, "examBlueprintId" | "targetDate"> & { id: string | null };
  itemIds?: readonly string[] | null;
  skillIds: readonly string[];
  structure: ExamStructure | null;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
  userId: string;
}): Promise<MockPlan> {
  const [candidates, mockNumber, finalStretchStart] = await Promise.all([
    loadMockCandidates({ goal, itemIds, skillIds, structure, userId }),
    countFinishedMocksBefore({ goalId: goal.id }),
    loadFinalStretchStart(goal.id),
  ]);

  const bySubject = toSubjectCandidates({ candidates, structure });

  const plan = (offset: number) =>
    planMock({
      adaptive: structure?.mock?.adaptive ?? false,
      candidates: bySubject,
      fullLength: isInFinalStretch({ finalStretchStart, targetDate: goal.targetDate, today }),
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
