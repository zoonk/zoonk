"use client";

import {
  answerPlanChangeAction,
  changePlanAction,
  chooseExamOptionAction,
} from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import {
  getGenerationIdAction,
  retryGenerationAction,
} from "@/app/[lang]/(app)/(onboarding)/start/onboarding-actions";
import { useRouter } from "@/i18n/navigation";
import { useAnswerSuggestedGoal } from "@/lib/goals/use-answer-suggested-goal";
import { useFollowTimeZone } from "@/lib/goals/use-follow-time-zone";
import { type LearnerBuddy } from "@/lib/learn/learner-buddy";
import { useReportTabMissions } from "@/lib/learn/tab-missions-provider";
import { useRefreshOnPlanChange } from "@/lib/learn/use-refresh-on-plan-change";
import { useRefreshWhenOld } from "@/lib/learn/use-refresh-when-old";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { answerMemoryInsightAction, catchUpTodayAction } from "@/lib/session/study-session-actions";
import { useMissionLinks, useStudyNavigation } from "@/lib/session/use-study-navigation";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { SpeakingPracticeRow } from "@zoonk/learn/language/speaking";
import { MockEntryRow } from "@zoonk/learn/mock/entry";
import { type TodayHostNotices, TodayScreen } from "@zoonk/learn/today";
import { TodayPreparing } from "@zoonk/learn/today/preparing";
import { SuggestedGoalOffer } from "@zoonk/learn/today/suggested-goal";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";

/**
 * Today with main's actions: each one opens where the session continues. It opens from its
 * prefetched copy and reads itself again when that copy is old.
 */
export function TodayClient({
  brainPower,
  buddy,
  level,
  mistakes,
  mocks,
  notices,
  planEnd,
  readAt,
  speaking,
  syllabus,
  today,
}: {
  /** The learner's Brain Power so far, which the missions' reward says when tapped. */
  brainPower: number | null;
  buddy: LearnerBuddy;
  /** A language goal's level, said where another goal's progress is; null otherwise. */
  level: LanguageTodayView["level"];
  /** Open entries in the goal's mistakes notebook. */
  mistakes: MistakeAvailability;
  /** An exam goal's mocks to take any time, when Today offers them; null otherwise. */
  mocks: MockOptionsView | null;
  notices: TodayHostNotices;
  planEnd: string | null;
  /** A language goal's exam-style speaking tasks, when its language has a paper; null otherwise. */
  speaking: LanguageTodayView["speaking"];
  /** When the page read `today` (`getReadAt`). */
  readAt: number;
  /** The goal's subjects as the Plan lists them; null when it has none. */
  syllabus: SyllabusView | null;
  today: TodayView;
}) {
  const router = useRouter();
  useRefreshWhenOld(readAt);
  useFollowTimeZone(today.goal.id);
  useReportTabMissions({ missions: today.session.missions, readAt });

  const refreshOnPlanChange = useRefreshOnPlanChange({
    goalId: today.goal.id,
    readAt,
    watch: "today",
  });

  const navigation = useStudyNavigation(today.session.id);
  const missionLinks = useMissionLinks(today.goal.id);
  const answerSuggestedGoal = useAnswerSuggestedGoal({ hasGoal: true });
  const startTestOut = useStartTestOut();

  return (
    <TodayScreen
      level={level}
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
        chooseExamOption: async (input) => {
          const outcome = await chooseExamOptionAction(today.goal.id, input);
          return outcome?.change ?? null;
        },
        chooseFocusHref: "/plan?focus=choose",
        continueSession: navigation.continueSession,
        decidePlanChange: (input) => answerPlanChangeAction(today.goal.id, input),
        examHref: "/exam",
        missionLinks,
        mistakesHref: "/mistakes",
        openBlock: navigation.openBlock,
        plusHref: "/subscription",
        refresh: refreshOnPlanChange,
        startTestOut: (chapterId) =>
          startTestOut({ chapterId, fromSession: true, goalId: today.goal.id }),
        studyEverythingHref: "/plan?focus=everything",
        summaryHref: "/session",
      }}
      brainPower={brainPower}
      buddy={buddy}
      // Read with the day's session: a read before opening Today built it had no missions yet.
      missions={{ fullMeal: today.session.fullMeal, missions: today.session.missions }}
      mistakes={mistakes}
      mockEntry={mocks && <MockEntryRow hrefs={MOCK_ENTRY_HREFS} view={mocks} />}
      notices={notices}
      planEnd={planEnd}
      speakingEntry={speaking && <SpeakingPracticeRow entry={speaking} href="/speaking" />}
      syllabus={syllabus}
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
    <SuggestedGoalOffer
      onAnswer={(status) => answer({ status, suggestion })}
      suggestion={suggestion}
    />
  );
}
