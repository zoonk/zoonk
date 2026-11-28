import { type TransactionClient } from "@zoonk/db";
import { type TrueFalseLabels } from "../../../library/exams/true-false-labels";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { type PlacementLoad } from "./load-placement-state";
import { readAttemptQuestions } from "./placement-attempt-questions";
import { type PlacementAttempt, type PlacementRecord } from "./placement-attempt-record";
import { type loadCourseAnswers } from "./placement-evidence";
import { coursePreparationFailed } from "./placement-plan-build";
import { readPlacementResult } from "./placement-result";
import { loadQuestion } from "./placement-state-view";

export async function loadAttemptState({
  attempt,
  attempts,
  trueFalseLabels,
  plan,
  tx,
}: {
  attempt: PlacementAttempt;
  attempts: Awaited<ReturnType<typeof loadCourseAnswers>>;
  trueFalseLabels: TrueFalseLabels;
  goalId: string;
  plan?: GoalPlan;
  tx: TransactionClient;
}): Promise<PlacementLoad> {
  const questions = readAttemptQuestions({ attempt, attempts, plan });
  const next = await loadQuestion(questions.itemId ?? undefined, tx);

  const idle = next ? "asking" : "done";
  const pending = coursePreparationFailed(attempt) ? "failed" : "waitingForQuestions";
  const status = questions.waiting ? pending : idle;

  return {
    focusTest: null,
    state: {
      answered: questions.answered,
      areas: [],
      attempt: {
        answered: questions.answered,
        chapter: questions.chapter,
        estimatedMinutes: questions.estimatedMinutes,
        id: attempt.id,
        length: "quick",
        part: 1,
        partComplete: false,
        questions: questions.questions,
      },
      complete: questions.complete,
      dayBudgetSpent: Math.min(1, questions.answered / questions.questions),
      dayBudgetUsed: questions.answered >= questions.questions,
      focusTest: null,
      knownSkillIds: questions.knownSkillIds,
      needsItems: [],
      next,
      phases: [],
      result: null,
      started: true,
      status,
      trueFalseLabels,
    },
  };
}

export async function readIdleCourse({
  goalId,
  placement,
  trueFalseLabels,
  tx,
}: {
  goalId: string;
  placement: PlacementRecord | null;
  trueFalseLabels: TrueFalseLabels;
  tx: TransactionClient;
}): Promise<PlacementLoad> {
  return {
    focusTest: null,
    state: {
      answered: 0,
      areas: [],
      attempt: null,
      complete: false,
      dayBudgetSpent: 0,
      dayBudgetUsed: false,
      focusTest: null,
      knownSkillIds: [],
      needsItems: [],
      next: null,
      phases: [],
      result: await readPlacementResult({ goalId, placement, tx }),
      started: false,
      status: "unavailable",
      trueFalseLabels,
    },
  };
}
