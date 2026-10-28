"use client";

import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useQuestionTutor } from "@/components/learn/use-question-tutor";
import { useRouter } from "@/i18n/navigation";
import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { type LearnerBuddy } from "@/lib/learn/learner-buddy";
import { recordGenerationWaitAction } from "@/lib/lessons/generation-wait-action";
import { useLessonPlayerHref } from "@/lib/lessons/use-lesson-player-href";
import { type DayEntry, type TapStep } from "@/lib/session/day-entry";
import {
  endDayEntry,
  failDayEntry,
  markDayEntryApplied,
  moveDayEntry,
} from "@/lib/session/day-entry-registry";
import { readWaitedLesson } from "@/lib/session/read-waited-lesson";
import { sendStudyAnswer } from "@/lib/session/study-answer-request";
import { finishStudyBlockAction } from "@/lib/session/study-session-actions";
import { useDayEntry, useDayTap } from "@/lib/session/use-day-entry";
import { useDayTaps } from "@/lib/session/use-day-taps";
import { useGoToStudyDestination, useStudyNavigation } from "@/lib/session/use-study-navigation";
import { WorkflowRunFollower } from "@/lib/workflow/workflow-run-follower";
import { type DayBlockRef } from "@zoonk/core/sessions/day-block";
import { GenerationFollowerProvider } from "@zoonk/learn/generation/follower";
import { type LessonNotWritten } from "@zoonk/learn/lesson-not-written";
import { QuestionBlock } from "@zoonk/learn/session/block";
import { NextStop, type NextStopLesson, type NextStopTap } from "@zoonk/learn/session/next-stop";
import { SessionSummary, type SummaryGoalKind } from "@zoonk/learn/session/summary";
import {
  type DayStep,
  type StudyBlock,
  type StudyBlockDetail,
  type StudyDay,
  type StudySession,
  type StudySessionSummary,
} from "@zoonk/learn/session/types";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useEffectEvent, useTransition } from "react";

const EXIT_HREF = "/today";
const SIGN_UP_HREF = "/login";

export function SessionBlockClient({
  detail,
  session,
  tutor,
}: {
  detail: StudyBlockDetail;
  session: StudySession;
  tutor: TutorViewer;
}) {
  const navigation = useStudyNavigation(session.id);
  const router = useRouter();
  const lessonHref = useLessonPlayerHref();
  const questionTutor = useQuestionTutor(tutor);
  const ids = { blockId: detail.block.id, sessionId: session.id };
  const firstUnanswered = detail.questions.find((question) => question.answered === null)?.itemId;

  useEffect(() => {
    endDayEntry();
  }, []);

  return (
    <QuestionBlock
      actions={{
        answer: (input) => sendStudyAnswer({ ...ids, ...input }),
        continueSession: navigation.continueSession,
        // Expiring the router's pages would draw the screen again over the moment, so it's noted for later.
        finish: () =>
          noteAppWrite(finishStudyBlockAction({ ...ids, timeZone: getLocalTimeZone() })),
        refresh: () => router.refresh(),
        stop: navigation.stop,
      }}
      buddy={tutor.buddy}
      renderCeremony={(milestone, onClose) => (
        <SessionCeremony buddy={tutor.buddy} milestone={milestone} onClose={onClose} />
      )}
      detail={detail}
      exitHref={EXIT_HREF}
      key={`${detail.block.id}:${firstUnanswered ?? "answered"}`}
      lessonHref={lessonHref}
      session={{ blocks: session.blocks, examTomorrow: session.examTomorrow, id: session.id }}
      tutor={questionTutor}
    />
  );
}

/** The tap's entry keeps the step busy until what it opened shows, so the step never goes idle first. */
function useApplyTap({ entry, tap }: { entry: DayEntry | null; tap: NextStopTap | null }): boolean {
  const router = useRouter();
  const go = useGoToStudyDestination();
  const [applying, startApplying] = useTransition();
  const result = tap ? entry?.result : null;

  const apply = useEffectEvent(() => {
    if (!entry || entry.applied || !result || result.kind === "failed") {
      return;
    }

    startApplying(async () => {
      markDayEntryApplied(entry.id);

      if (result.kind === "refresh") {
        router.refresh();
        return;
      }

      const went = await go(result.destination, {
        onSessionAddress: (address) => moveDayEntry(entry.id, address),
      });

      if (!went) {
        failDayEntry(entry.id);
      }
    });
  });

  useEffect(() => {
    if (result) {
      apply();
    }
  }, [result]);

  useEffect(() => {
    if (!applying && entry?.applied) {
      endDayEntry(entry.id);
    }
  }, [applying, entry]);

  return applying;
}

export function SessionNextStopClient({
  alternative,
  asked,
  day,
  generationId,
  goalId,
  lesson,
  notWritten,
  step,
  stepRef,
  userId,
}: {
  alternative: StudyBlock | null;
  asked: boolean;
  day: StudyDay;
  generationId: string | null;
  goalId: string;
  lesson: NextStopLesson;
  notWritten: LessonNotWritten | null;
  step: DayStep;
  stepRef: DayBlockRef | null;
  userId: string;
}) {
  const router = useRouter();
  const locale = useLocale();
  const sessionId = day.status === "unstarted" ? null : day.id;
  const navigation = useStudyNavigation(sessionId ?? "");
  const refresh = useCallback(() => router.refresh(), [router]);
  const taps = useDayTaps({ day: { sessionId, shown: { day, goalId, userId } }, refresh });
  const entry = useDayEntry();
  const tapped = useDayTap({ blocks: day.blocks, goalId, localDate: day.localDate });
  const applying = useApplyTap({ entry, tap: tapped?.tap ?? null });

  const tap =
    tapped?.tap ??
    (applying && entry
      ? { focus: entry.focusMain, state: "opening" as const, tappedAt: entry.tappedAt }
      : null);

  const own = !tapped || tapped.step.position === step.position;
  const drawn = tapped ? tapped.step : step;
  const drawnRef = own ? stepRef : (entry?.step.ref ?? null);

  const toTapStep = (target: DayStep): TapStep => ({
    blockId: "id" in target ? target.id : null,
    position: target.position,
    ref: target.position === drawn.position ? drawnRef : null,
    screen: "session",
  });

  const start = (target: DayStep) =>
    target.position === step.position && sessionId === null
      ? taps.next(toTapStep(target))
      : taps.open(toTapStep(target));

  return (
    <GenerationFollowerProvider follower={WorkflowRunFollower}>
      <NextStop
        actions={{
          openWrittenLesson: (target) =>
            "id" in target ? navigation.openWrittenLesson(target.id) : start(target),
          readLesson: readWaitedLesson,
          recordWait: (milliseconds) =>
            void recordGenerationWaitAction({ contentKind: "lesson", locale, milliseconds }),
          refresh,
          start,
          stop: navigation.stop,
        }}
        alternative={tapped ? null : alternative}
        asked={tapped ? false : asked}
        block={drawn}
        blocks={day.blocks}
        exitHref={EXIT_HREF}
        generationId={tapped ? null : generationId}
        lesson={tapped ? "ready" : lesson}
        lessonsComing={day.lessonsComing}
        notWritten={tapped ? null : notWritten}
        sessionBar={day.sessionBar}
        tap={tap}
      />
    </GenerationFollowerProvider>
  );
}

export function SessionSummaryClient({
  goalKind,
  isGuest,
  buddy,
  sessionId,
  stopped,
  summary,
}: {
  goalKind: SummaryGoalKind;
  isGuest: boolean;
  buddy: LearnerBuddy;
  sessionId: string;
  stopped: boolean;
  summary: StudySessionSummary;
}) {
  const navigation = useStudyNavigation(sessionId);
  const router = useRouter();

  return (
    <SessionSummary
      actions={{
        addExtraTime: navigation.addExtraTime,
        keepGoing: navigation.continueSession,
        refresh: () => router.refresh(),
      }}
      buddy={buddy}
      exitHref={EXIT_HREF}
      goalKind={goalKind}
      mistakesHref="/mistakes"
      renderCeremony={(milestone, onClose) => (
        <SessionCeremony buddy={buddy} milestone={milestone} onClose={onClose} />
      )}
      signUpHref={isGuest ? SIGN_UP_HREF : null}
      stopped={stopped}
      summary={summary}
    />
  );
}
