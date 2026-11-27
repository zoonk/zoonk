import { type TransactionClient } from "@zoonk/db";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { getAreaStarts, getPhaseStarts } from "../placement-steps";
import { type PlacementFacts, type PlacementLoad } from "./load-placement-state";
import { readAttemptQuestions } from "./placement-attempt-questions";
import { type PlacementAttempt } from "./placement-attempt-record";
import { readPlacementResult } from "./placement-result";
import { loadQuestion } from "./placement-state-view";

export async function loadAttemptState({
  attempt,
  facts,
  goalId,
  plan,
  tx,
}: {
  attempt: PlacementAttempt;
  facts: PlacementFacts;
  goalId: string;
  plan: GoalPlan;
  tx: TransactionClient;
}): Promise<PlacementLoad> {
  const { attempts, build, exam, items } = facts;
  const questions = readAttemptQuestions({ attempt, attempts, build, items, plan });
  const next = await loadQuestion(questions.item?.id, tx);
  const statuses = new Map(questions.knownSkillIds.map((id) => [id, "known" as const]));

  let status: PlacementLoad["state"]["status"] = "unavailable";

  if (attempt.partComplete || attempt.paused || questions.complete) {
    status = "done";
  } else if (next) {
    status = "asking";
  } else if (questions.waiting) {
    status = "waitingForQuestions";
  } else if (build.failed && plan.skills.length === 0) {
    status = "failed";
  }

  const result =
    attempt.paused || attempt.partComplete
      ? await readPlacementResult({ goalId, placement: exam.placement, tx })
      : null;

  return {
    attemptNextPart: questions.nextPart,
    attemptQuestions: questions,
    focusTest: null,
    state: {
      answered: questions.answered,
      areas: getAreaStarts({ skills: plan.skills, statuses }),
      attempt: {
        answered: Math.min(questions.answered, questions.questions),
        chapter: next ? questions.chapter : null,
        estimatedMinutes: questions.estimatedMinutes,
        id: attempt.id,
        length: attempt.length,
        nextPart: questions.nextPart?.part ?? null,
        part: attempt.part,
        partComplete: attempt.partComplete,
        parts: questions.parts,
        partsLeft: questions.partsLeft,
        questions: questions.questions,
        resume:
          attempt.paused && !questions.complete
            ? { part: attempt.part, question: questions.answered + 1 }
            : null,
        totalEstimatedMinutes: questions.totalEstimatedMinutes,
      },
      complete: questions.complete,
      dayBudgetSpent: Math.min(1, questions.answered / questions.questions),
      dayBudgetUsed: questions.answered >= questions.questions,
      focusTest: null,
      knownSkillIds: questions.knownSkillIds,
      needsItems: [],
      next,
      phases: getPhaseStarts({ skills: plan.skills, statuses }),
      result,
      started: true,
      status,
      trueFalseLabels: exam.trueFalseLabels,
    },
  };
}
