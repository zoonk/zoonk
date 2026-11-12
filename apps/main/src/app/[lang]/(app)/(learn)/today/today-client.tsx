"use client";

import {
  changePlanAction,
  chooseExamOptionAction,
} from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { getFocusTestActions } from "@/app/[lang]/(app)/(onboarding)/start/focus-test-client-actions";
import { UploadRequestClient } from "@/components/learn/upload-request-client";
import { useRouter } from "@/i18n/navigation";
import { updateFocusTestAction } from "@/lib/focus-test/focus-test-controls";
import { STARTED_FOCUS_TEST_HREF } from "@/lib/focus-test/focus-test-href";
import { useAnswerSuggestedGoal } from "@/lib/goals/use-answer-suggested-goal";
import { useFollowTimeZone } from "@/lib/goals/use-follow-time-zone";
import { toStudyDayDate } from "@/lib/learn/tab-missions";
import { useReportTabMissions } from "@/lib/learn/tab-missions-provider";
import { useRefreshOnPlanChange } from "@/lib/learn/use-refresh-on-plan-change";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { getLessonAgainHref } from "@/lib/public/public-hrefs";
import { type TapStep } from "@/lib/session/day-entry";
import { getStudyLessonHref } from "@/lib/session/lesson-opening";
import { answerMemoryInsightAction } from "@/lib/session/study-session-actions";
import { useDayTaps } from "@/lib/session/use-day-taps";
import { useMissionLinks } from "@/lib/session/use-mission-links";
import { getSessionHref } from "@/lib/session/use-study-navigation";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { type GoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { type DayBlockRef, findNextCall } from "@zoonk/core/sessions/day-block";
import { SpeakingPracticeRow } from "@zoonk/learn/language/speaking";
import { LanguagePracticeRow } from "@zoonk/learn/language/today";
import { MockEntryRow } from "@zoonk/learn/mock/entry";
import { type DayStep } from "@zoonk/learn/session/types";
import { type TodayHostNotices, TodayScreen } from "@zoonk/learn/today";
import { TodayChangeNotice } from "@zoonk/learn/today/change-notice";
import { SuggestedGoalOffer } from "@zoonk/learn/today/suggested-goal";
import { useTodayVisit } from "@zoonk/learn/today/visit";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type TodayScreenData } from "./today-view";
import { useDecidePlanChange } from "./use-decide-plan-change";

/** Again each time the router drops the prefetch; it fetches nothing for a copy it still holds fresh. */
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

/** `answered` is null when the learner dismissed the request. */
type UploadAnswer = { answered: GoalUploadRequest | null; visit: number };

/**
 * An upload ask answered here shows its thanks while the learner stays, whatever Today read since,
 * and one dismissed here stays away.
 */
function toHostNotices({
  answeredUpload,
  data,
  goalId,
  onUploadAnswered,
  onUploadDismissed,
  uploadDismissed,
}: {
  answeredUpload: GoalUploadRequest | null;
  data: TodayScreenData;
  goalId: string;
  onUploadAnswered: (request: GoalUploadRequest) => void;
  onUploadDismissed: () => void;
  uploadDismissed: boolean;
}): TodayHostNotices {
  const { language, today } = data;
  const hasPractice = Boolean(today.pattern ?? language?.pronunciation);
  const upload = answeredUpload ?? (uploadDismissed ? null : today.uploadRequest);

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
    sourceChange: today.sourceChange ? <TodayChangeNotice message={today.sourceChange} /> : null,
    uploadRequest: upload ? (
      <UploadRequestClient
        answered={answeredUpload !== null}
        onAnswered={() => onUploadAnswered(upload)}
        onDismissed={onUploadDismissed}
        request={upload}
      />
    ) : null,
  };
}

function toTapSteps(data: TodayScreenData): TapStep[] {
  return data.today.session.blocks.flatMap((block, index) => {
    const step = data.steps[index];

    return step
      ? [{ ...step, blockId: "id" in block ? block.id : null, position: block.position }]
      : [];
  });
}

function useFocusTestSuggestionActions(goalId: string) {
  const router = useRouter();

  return {
    dismissFocusTest: async (): Promise<boolean> => {
      const saved = await updateFocusTestAction(goalId, {
        suggestion: "dismissed",
        timeZone: getLocalTimeZone(),
      });

      return saved !== null;
    },
    /** The start is the learner's press here, so the test's page opens on its first question. */
    startFocusTest: async (): Promise<boolean> => {
      const outcome = await getFocusTestActions(goalId).start();

      if (outcome.status === "failed") {
        return false;
      }

      router.push(STARTED_FOCUS_TEST_HREF);
      return true;
    },
  };
}

/** The page keys it by goal and day, so a new day (midnight, a goal switch) draws fresh. */
export function TodayClient({
  banner,
  data,
  readAt,
  unfinishedGoal,
  userId,
}: {
  banner: React.ReactNode;
  data: TodayScreenData;
  readAt: number;
  unfinishedGoal: React.ReactNode;
  userId: string;
}) {
  const router = useRouter();
  const { today } = data;
  const goalId = today.session.goalId ?? today.goal.id;
  const refresh = useCallback(() => router.refresh(), [router]);
  const steps = useMemo(() => toTapSteps(data), [data]);
  const focusTestActions = useFocusTestSuggestionActions(today.goal.id);

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

  const showIntro = useCallback(
    (blockId: string) => {
      const step = steps.find((candidate) => candidate.blockId === blockId);
      return step ? taps.showIntro({ next: false, step }) : false;
    },
    [steps, taps],
  );

  const missionLinks = useMissionLinks(today.goal.id, {
    learner: userId,
    openStep,
    refresh,
    showIntro,
  });

  const visit = useTodayVisit();
  const [upload, setUpload] = useState<UploadAnswer | null>(null);
  const uploadThisVisit = upload?.visit === visit ? upload : null;
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

  usePrefetchSessionFrame(sessionHref);

  return (
    <TodayScreen
      banner={banner}
      level={data.language?.level ?? null}
      readAt={readAt}
      actions={{
        ...focusTestActions,
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
        completedLessonsHref: "/completed-lessons",
        continueHref: (() => {
          const next = today.session.blocks.find(
            (block) => block.position === today.session.nextPosition,
          );

          return (
            (next &&
              getStudyLessonHref({ block: next, goalId: today.goal.id, session: today.session })) ||
            (call ? `/checkpoint/${call.blockId}?session=${call.sessionId}` : null)
          );
        })(),
        continueSession: () => {
          const next = stepAt(today.session.nextPosition);
          return next ? taps.next(next) : Promise.resolve(false);
        },
        decidePlanChange,
        examHref: "/exam",
        lessonAgainHref: (lessonId) => getLessonAgainHref({ lessonId, origin: "/today" }),
        lessonHref: (block) =>
          getStudyLessonHref({ block, goalId: today.goal.id, session: today.session }),
        missionLinks,
        mistakesHref: "/mistakes",
        openBlock: (block: DayStep) => {
          const step = stepAt(block.position);
          return step ? taps.open(step) : Promise.resolve(false);
        },
        plusHref: "/subscription",
        prepareLessons: taps.prepareLessons,
        refresh: refreshOnPlanChange,
        startTestOut: (chapterId) =>
          startTestOut({ chapterId, fromSession: true, goalId: today.goal.id }),
        studyEverythingHref: "/plan?focus=everything",
        summaryHref: sessionHref,
      }}
      brainPower={data.brainPower}
      buddy={data.buddy}
      completedLessons={data.completedLessons}
      missions={{ fullMeal: today.session.fullMeal, missions: today.session.missions }}
      mistakes={data.mistakes}
      mockEntry={data.mocks && <MockEntryRow hrefs={MOCK_ENTRY_HREFS} view={data.mocks} />}
      notices={toHostNotices({
        answeredUpload: uploadThisVisit?.answered ?? null,
        data,
        goalId: today.goal.id,
        onUploadAnswered: (request) => setUpload({ answered: request, visit }),
        onUploadDismissed: () => setUpload({ answered: null, visit }),
        uploadDismissed: uploadThisVisit !== null,
      })}
      planEnd={data.planEnd}
      speakingEntry={
        data.language?.speaking && (
          <SpeakingPracticeRow entry={data.language.speaking} href="/speaking" />
        )
      }
      syllabus={data.syllabus}
      today={today}
      unfinishedGoal={unfinishedGoal}
    />
  );
}

export function SuggestedGoalClient({ suggestion }: { suggestion: SuggestedGoalView }) {
  const answer = useAnswerSuggestedGoal({ hasGoal: false });

  return (
    <SuggestedGoalOffer
      onAnswer={(status) => answer({ status, suggestion })}
      suggestion={suggestion}
    />
  );
}
