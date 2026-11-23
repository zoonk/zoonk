import { type TransactionClient } from "@zoonk/db";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { getAreaStarts, getPhaseStarts } from "../placement-steps";
import { type PlacementFacts, type PlacementLoad } from "./load-placement-state";
import { readAttemptQuestions } from "./placement-attempt-questions";
import { type PlacementAttempt, placementAttemptView } from "./placement-attempt-record";
import { getStatus, loadQuestion } from "./placement-state-view";

export async function loadAttemptState({
  attempt,
  facts,
  plan,
  today,
  tx,
}: {
  attempt: PlacementAttempt;
  facts: PlacementFacts;
  plan: GoalPlan;
  today: Date | null;
  tx: TransactionClient;
}): Promise<PlacementLoad> {
  const { attempts, build, exam, items } = facts;
  const questions = readAttemptQuestions({ attempt, attempts, build, items, plan, today });
  const next = await loadQuestion(questions.item?.id, tx);
  const statuses = new Map(questions.knownSkillIds.map((id) => [id, "known" as const]));

  return {
    attemptFollowUps: questions.followUpSkillIds,
    attemptHasMore: questions.hasMore,
    attemptRemainingSkillIds: questions.remainingSkillIds,
    focusTest: null,
    state: {
      answered: questions.answered,
      areas: getAreaStarts({ skills: plan.skills, statuses }),
      attempt: placementAttemptView({ ...attempt, estimatedMinutes: questions.estimatedMinutes }),
      complete: questions.complete,
      dayBudgetSpent: questions.spent,
      dayBudgetUsed: questions.spent >= 1,
      focusTest: null,
      knownSkillIds: questions.knownSkillIds,
      needsItems: [],
      next,
      phases: getPhaseStarts({ skills: plan.skills, statuses }),
      result: exam.placement?.result ?? null,
      started: true,
      status: getStatus({
        buildFailed: build.failed,
        complete: questions.complete,
        dayBudgetUsed: attempt.partComplete || questions.spent >= 1,
        hasEvidence: questions.answered > 0,
        hasNext: next !== null,
        hasSkills: plan.skills.length > 0,
        tested: false,
        waitsForQuestions: questions.waiting,
      }),
      trueFalseLabels: exam.trueFalseLabels,
    },
  };
}
