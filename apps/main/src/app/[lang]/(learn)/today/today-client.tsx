"use client";

import {
  answerPlanChangeAction,
  changePlanAction,
} from "@/app/[lang]/(learn)/journey/journey-actions";
import {
  getGenerationIdAction,
  retryGenerationAction,
} from "@/app/[lang]/start/onboarding-actions";
import { useRouter } from "@/i18n/navigation";
import { useAnswerSuggestedGoal } from "@/lib/goals/use-answer-suggested-goal";
import { dismissGuardianInviteAction } from "@/lib/guardian/guardian-invite-actions";
import { type LearnerBuddy } from "@/lib/learn/learner-buddy";
import { useRefreshWhenOld } from "@/lib/learn/use-refresh-when-old";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { answerMemoryInsightAction, catchUpTodayAction } from "@/lib/session/study-session-actions";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { MockEntryRow } from "@zoonk/learn/mock/entry";
import { type TodayHostNotices, TodayScreen } from "@zoonk/learn/today";
import { TodayPreparing } from "@zoonk/learn/today/preparing";
import { SuggestedGoalCard } from "@zoonk/learn/today/suggested-goal";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";

/**
 * Today with main's actions: each one opens where the session continues. It opens from its
 * prefetched copy and reads itself again when that copy is old.
 */
export function TodayClient({
  buddy,
  mistakes,
  mocks,
  notices,
  planEnd,
  readAt,
  today,
}: {
  buddy: LearnerBuddy;
  /** Open entries in the goal's mistakes notebook. */
  mistakes: number;
  /** An exam goal's mocks to take any time, when Today offers them; null otherwise. */
  mocks: MockOptionsView | null;
  notices: TodayHostNotices;
  planEnd: string | null;
  /** When the page read `today` (`getReadAt`). */
  readAt: number;
  today: TodayView;
}) {
  const router = useRouter();
  useRefreshWhenOld(readAt);
  const navigation = useStudyNavigation(today.session.id);
  const answerSuggestedGoal = useAnswerSuggestedGoal({ hasGoal: true });
  const startTestOut = useStartTestOut();

  return (
    <TodayScreen
      actions={{
        addExtraTime: navigation.addExtraTime,
        answerInsight: answerMemoryInsightAction,
        answerSuggestedGoal,
        buddyHref: "/buddy",
        catchUp: async () => {
          const added = await catchUpTodayAction({
            sessionId: today.session.id,
            timeZone: getLocalTimeZone(),
          });

          if (added) {
            router.refresh();
          }

          return added;
        },
        challengeHref: (planItemId) => `/challenge/${planItemId}`,
        changePlan: async (operations) => {
          const outcome = await changePlanAction(today.goal.id, operations);
          return outcome?.status === "applied" ? outcome.change : null;
        },
        chooseFocusHref: "/journey?focus=choose",
        continueSession: navigation.continueSession,
        decidePlanChange: (input) => answerPlanChangeAction(today.goal.id, input),
        dismissGuardianInvite: dismissGuardianInviteAction,
        examHref: "/exam",
        mistakesHref: "/mistakes",
        plusHref: "/subscription",
        refresh: () => router.refresh(),
        startTestOut: (chapterId) =>
          startTestOut({ chapterId, fromSession: true, goalId: today.goal.id }),
        summaryHref: "/session",
      }}
      buddy={buddy}
      mistakes={mistakes}
      mockEntry={mocks && <MockEntryRow hrefs={MOCK_ENTRY_HREFS} view={mocks} />}
      notices={notices}
      planEnd={planEnd}
      today={today}
    />
  );
}

/**
 * The wait while the goal's plan is built: it follows the goal's run live and reads Today again
 * once the plan is ready. "Try again" starts the run again only when the learner taps it.
 */
export function TodayPreparingClient({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  const router = useRouter();

  const run = useWorkflowRun({
    generationId: null,
    kind: "firstLesson",
    onReady: () => router.refresh(),
    readGenerationId: () => getGenerationIdAction(goalId),
    restart: () => retryGenerationAction(goalId),
  });

  return <TodayPreparing goalTitle={goalTitle} onRefresh={() => router.refresh()} run={run} />;
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
