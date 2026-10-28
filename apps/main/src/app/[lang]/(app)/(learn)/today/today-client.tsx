"use client";

import {
  changePlanAction,
  chooseExamOptionAction,
} from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { retryGenerationAction } from "@/app/[lang]/(app)/(onboarding)/start/onboarding-actions";
import { UploadRequestClient } from "@/components/learn/upload-request-client";
import { useRouter } from "@/i18n/navigation";
import { readGoalGenerationId } from "@/lib/goals/read-goal-generation-id";
import { useAnswerSuggestedGoal } from "@/lib/goals/use-answer-suggested-goal";
import { useFollowTimeZone } from "@/lib/goals/use-follow-time-zone";
import { toStudyDayDate } from "@/lib/learn/tab-missions";
import { useReportTabMissions } from "@/lib/learn/tab-missions-provider";
import { useRefreshOnPlanChange } from "@/lib/learn/use-refresh-on-plan-change";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { type TapStep } from "@/lib/session/day-entry";
import { answerMemoryInsightAction } from "@/lib/session/study-session-actions";
import { useDayTaps } from "@/lib/session/use-day-taps";
import { getSessionHref, useMissionLinks } from "@/lib/session/use-study-navigation";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { type GoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { type DayBlockRef, findNextCall } from "@zoonk/core/sessions/day-block";
import { SpeakingPracticeRow } from "@zoonk/learn/language/speaking";
import { LanguagePracticeRow } from "@zoonk/learn/language/today";
import { MockEntryRow } from "@zoonk/learn/mock/entry";
import { type DayStep } from "@zoonk/learn/session/types";
import { type TodayHostNotices, TodayScreen } from "@zoonk/learn/today";
import { TodayChangeNotice } from "@zoonk/learn/today/change-notice";
import { TodayPreparing } from "@zoonk/learn/today/preparing";
import { SuggestedGoalOffer } from "@zoonk/learn/today/suggested-goal";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type TodayScreenData } from "./today-view";
import { useDecidePlanChange } from "./use-decide-plan-change";

/**
 * Prefetches the session screen's frame for this day's taps, so a step that plays there opens at
 * once, and again each time the router drops that prefetch (a write that expired the page, or the
 * copy grown stale). Today mounting anew asks again; the router fetches nothing for a copy it
 * still holds fresh.
 */
function usePrefetchSessionFrame(href: string) {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const prefetch = () => {
      if (active) {
        router.prefetch(href, { onInvalidate: prefetch });
      }
    };

    prefetch();

    return () => {
      active = false;
    };
  }, [href, router]);
}

/**
 * Today's notices that need main's components, drawn from what Today read: a language goal's due
 * practice, the newest change to a source the goal is built on, and an upload research asks for.
 * An upload ask the learner answered here (`answeredUpload`) shows its thanks while they stay,
 * whatever Today read since, even when a read dropped it before the answer arrived; another tab
 * drops it.
 */
function toHostNotices({
  answeredUpload,
  data,
  goalId,
  onUploadAnswered,
}: {
  answeredUpload: GoalUploadRequest | null;
  data: TodayScreenData;
  goalId: string;
  onUploadAnswered: (request: GoalUploadRequest) => void;
}): TodayHostNotices {
  const { language, notices, today } = data;
  const hasPractice = Boolean(today.pattern ?? language?.pronunciation);
  const upload = answeredUpload ?? notices.upload;

  return {
    practice:
      language && hasPractice ? (
        <LanguagePracticeRow
          hrefs={{
            pattern: today.pattern ? `/pattern/${today.pattern.id}` : null,
            pronunciation: `/pronunciation?goal=${goalId}`,
          }}
          today={{ pattern: today.pattern, pronunciation: language.pronunciation }}
        />
      ) : null,
    sourceChange: notices.change ? <TodayChangeNotice message={notices.change} /> : null,
    uploadRequest: upload ? (
      <UploadRequestClient
        answered={answeredUpload !== null}
        onAnswered={() => onUploadAnswered(upload)}
        request={upload}
      />
    ) : null,
  };
}

/** The day's steps with where each plays and the work it is, as Today read them. */
function toTapSteps(data: TodayScreenData): TapStep[] {
  return data.today.session.blocks.flatMap((block, index) => {
    const step = data.steps[index];

    return step
      ? [{ ...step, blockId: "id" in block ? block.id : null, position: block.position }]
      : [];
  });
}

/**
 * The day on Today with main's actions: each one opens where the step is played, opening a day
 * the learner hasn't opened yet with the tap that names its step. The page keys it by its goal and
 * day, so a new day (midnight, a goal switch) draws fresh. Writes that expire the learner's tags
 * render Today again on their own; a tap that reads the day again refreshes it.
 */
export function TodayClient({
  data,
  readAt,
  userId,
}: {
  data: TodayScreenData;
  readAt: number;
  userId: string;
}) {
  const router = useRouter();
  const { today } = data;
  const goalId = today.session.goalId ?? today.goal.id;
  const refresh = useCallback(() => router.refresh(), [router]);
  const steps = useMemo(() => toTapSteps(data), [data]);

  const taps = useDayTaps({
    day: {
      sessionId: today.session.status === "unstarted" ? null : today.session.id,
      shown: { day: today.session, goalId, userId },
    },
    refresh,
  });

  const stepAt = (position: number | null) => steps.find((step) => step.position === position);

  const openStep = useCallback(
    (ref: DayBlockRef) => {
      const step = steps.find((candidate) => candidate.position === ref.position);
      return step ? taps.open(step) : Promise.resolve(false);
    },
    [steps, taps],
  );

  const missionLinks = useMissionLinks(today.goal.id, { openStep, refresh });
  const [answeredUpload, setAnsweredUpload] = useState<GoalUploadRequest | null>(null);
  const answerSuggestedGoal = useAnswerSuggestedGoal({ hasGoal: true });
  const startTestOut = useStartTestOut();
  const sessionHref = getSessionHref({ goalId, limit: null });
  const call = findNextCall({ goalKind: today.goal.kind, session: today.session });

  useFollowTimeZone(goalId);

  const decidePlanChange = useDecidePlanChange(today);

  useReportTabMissions({
    day: { goalId, localDate: toStudyDayDate(today.session.localDate) },
    missions: today.session.missions,
    readAt,
    userId,
  });

  const refreshOnPlanChange = useRefreshOnPlanChange({
    goalId: today.goal.id,
    readAt,
    watch: "today",
  });

  // The session screen's frame is static: with it at hand, a step that plays there opens at once.
  usePrefetchSessionFrame(sessionHref);

  return (
    <TodayScreen
      level={data.language?.level ?? null}
      actions={{
        addExtraTime: taps.addExtraTime,
        adjustTimeHref: "/plan?focus=time",
        answerInsight: answerMemoryInsightAction,
        answerSuggestedGoal,
        buddyHref: "/buddy",
        catchUp: taps.catchUp,
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
        continueHref: call ? `/checkpoint/${call.blockId}?session=${call.sessionId}` : null,
        continueSession: () => {
          const next = stepAt(today.session.nextPosition);
          return next ? taps.next(next) : Promise.resolve(false);
        },
        decidePlanChange,
        examHref: "/exam",
        missionLinks,
        mistakesHref: "/mistakes",
        openBlock: (block: DayStep) => {
          const step = stepAt(block.position);
          return step ? taps.open(step) : Promise.resolve(false);
        },
        plusHref: "/subscription",
        refresh: refreshOnPlanChange,
        startTestOut: (chapterId) =>
          startTestOut({ chapterId, fromSession: true, goalId: today.goal.id }),
        studyEverythingHref: "/plan?focus=everything",
        summaryHref: sessionHref,
      }}
      brainPower={data.brainPower}
      buddy={data.buddy}
      missions={{ fullMeal: today.session.fullMeal, missions: today.session.missions }}
      mistakes={data.mistakes}
      mockEntry={data.mocks && <MockEntryRow hrefs={MOCK_ENTRY_HREFS} view={data.mocks} />}
      notices={toHostNotices({
        answeredUpload,
        data,
        goalId: today.goal.id,
        onUploadAnswered: setAnsweredUpload,
      })}
      planEnd={data.planEnd}
      speakingEntry={
        data.language?.speaking && (
          <SpeakingPracticeRow entry={data.language.speaking} href="/speaking" />
        )
      }
      syllabus={data.syllabus}
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
    readGenerationId: () => readGoalGenerationId(goalId),
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
