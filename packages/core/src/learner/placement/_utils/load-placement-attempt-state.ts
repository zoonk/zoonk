import { type TransactionClient } from "@zoonk/db";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { type PlacementFacts, type PlacementLoad } from "./load-placement-state";
import { readAttemptQuestions } from "./placement-attempt-questions";
import { type PlacementAttempt } from "./placement-attempt-record";
import { loadQuestion } from "./placement-state-view";

export async function loadAttemptState({
  attempt,
  facts,
  plan,
  tx,
}: {
  attempt: PlacementAttempt;
  facts: PlacementFacts;
  goalId: string;
  plan: GoalPlan;
  tx: TransactionClient;
}): Promise<PlacementLoad> {
  const questions = readAttemptQuestions({ attempt, attempts: facts.attempts, plan });
  const next = await loadQuestion(questions.itemId ?? undefined, tx);
  const status = questions.waiting ? "waitingForQuestions" : next ? "asking" : "done";
  return {
    attemptQuestions: questions,
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
      trueFalseLabels: facts.exam.trueFalseLabels,
    },
  };
}
