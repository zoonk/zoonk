"use client";

import {
  getGenerationIdAction,
  retryGenerationAction,
} from "@/app/[lang]/start/onboarding-actions";
import { useRouter } from "@/i18n/navigation";
import { useAnswerSuggestedGoal } from "@/lib/goals/use-answer-suggested-goal";
import { answerMemoryInsightAction } from "@/lib/session/study-session-actions";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { type LearnBuddy } from "@zoonk/learn/navigation";
import { TodayScreen } from "@zoonk/learn/today";
import { TodayPreparing } from "@zoonk/learn/today/preparing";
import { SuggestedGoalCard } from "@zoonk/learn/today/suggested-goal";

/** Today with main's actions: each one opens where the session continues. */
export function TodayClient({ buddy, today }: { buddy: LearnBuddy | null; today: TodayView }) {
  const router = useRouter();
  const navigation = useStudyNavigation(today.session.id);
  const answerSuggestedGoal = useAnswerSuggestedGoal({ hasGoal: true });

  return (
    <TodayScreen
      actions={{
        addExtraTime: navigation.addExtraTime,
        answerInsight: answerMemoryInsightAction,
        answerSuggestedGoal,
        continueSession: navigation.continueSession,
        examHref: "/exam",
        plusHref: "/subscription",
        refresh: () => router.refresh(),
        summaryHref: "/session",
      }}
      buddy={buddy}
      today={today}
    />
  );
}

/**
 * The wait while the goal's plan is built: it follows the goal's run live and reads Today again
 * once the plan is ready. "Try again" starts the run again only when the learner taps it.
 */
export function TodayPreparingClient({
  buddy,
  goalId,
  goalTitle,
}: {
  buddy: LearnBuddy | null;
  goalId: string;
  goalTitle: string;
}) {
  const router = useRouter();

  const run = useWorkflowRun({
    generationId: null,
    kind: "firstLesson",
    onReady: () => router.refresh(),
    readGenerationId: () => getGenerationIdAction(goalId),
    restart: () => retryGenerationAction(goalId),
  });

  return (
    <TodayPreparing
      buddy={buddy}
      goalTitle={goalTitle}
      onRefresh={() => router.refresh()}
      run={run}
    />
  );
}

/** A learner without a goal who was taking a course before goals existed: it's offered first. */
export function SuggestedGoalClient({ suggestion }: { suggestion: SuggestedGoalView }) {
  const answer = useAnswerSuggestedGoal({ hasGoal: false });

  return (
    <SuggestedGoalCard
      onAnswer={(status) => answer({ status, suggestion })}
      suggestion={suggestion}
    />
  );
}
