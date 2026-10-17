"use client";

import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useQuestionTutor } from "@/components/learn/use-question-tutor";
import { useRouter } from "@/i18n/navigation";
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
import {
  answerStudyQuestionAction,
  finishStudyBlockAction,
} from "@/lib/session/study-session-actions";
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

/**
 * A question block of today's session: capsules, practice or a mistake drill, with the learner's
 * buddy to ask about the question in view.
 */
export function SessionBlockClient({
  detail,
  session,
  tutor,
}: {
  detail: StudyBlockDetail;
  session: StudySession;
  /** Who asks and the buddy who answers (`getTutorViewer`). */
  tutor: TutorViewer;
}) {
  const navigation = useStudyNavigation(session.id);
  const router = useRouter();
  const lessonHref = useLessonPlayerHref();
  const questionTutor = useQuestionTutor(tutor);
  const ids = { blockId: detail.block.id, sessionId: session.id };

  // The question block a tap opened is on screen: the tap is done.
  useEffect(() => {
    endDayEntry();
  }, []);

  return (
    <QuestionBlock
      actions={{
        answer: (input) =>
          answerStudyQuestionAction({ ...ids, ...input, timeZone: getLocalTimeZone() }),
        continueSession: navigation.continueSession,
        finish: () => finishStudyBlockAction({ ...ids, timeZone: getLocalTimeZone() }),
        refresh: () => router.refresh(),
        stop: navigation.stop,
      }}
      detail={detail}
      exitHref={EXIT_HREF}
      key={detail.block.id}
      lessonHref={lessonHref}
      session={{
        blocks: session.blocks,
        examTomorrow: session.examTomorrow,
        id: session.id,
        missions: session.missions,
      }}
      tutor={questionTutor}
    />
  );
}

/**
 * Applies what a tap came to, once its answer arrives: the session screen reads itself again in
 * place, opens at the address of the block the tap opened when that's another (the entry follows,
 * so its frame draws that block busy), or goes where the step plays. The tap's entry keeps the step
 * busy while that happens, and ends with it, so what the tap opened replaces the step without the
 * step going idle first. When nothing opened after all (its lesson couldn't be asked for), the step
 * says so, with Start to try again. True while it's under way.
 */
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

  // What the tap opened is on screen: the entry is done.
  useEffect(() => {
    if (!applying && entry?.applied) {
      endDayEntry(entry.id);
    }
  }, [applying, entry]);

  return applying;
}

/**
 * The next stop of either kind of day when nothing is open yet: the wait while its lesson is
 * written, following the run writing it live from the API, or why it won't be written now. A step
 * a tap from this tab named is drawn instead, busy from that tap until what it opened shows, even
 * when it isn't the day's next (a row further down Today's list). Start opens a day not opened yet
 * with the step it shows, as Today's does, and so does a lesson written while the step waited.
 */
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
  /** The address carries the learner's request for this step's lesson. */
  asked: boolean;
  day: StudyDay;
  generationId: string | null;
  goalId: string;
  lesson: NextStopLesson;
  notWritten: LessonNotWritten | null;
  step: DayStep;
  /** The work the step is, which opens it on a day not opened yet. */
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

  // While the tap's result is applied (its address moving to where the step is now, a lesson's
  // request on its way), the step stays busy from that tap, counting from it.
  const tap =
    tapped?.tap ??
    (applying && entry
      ? { focus: entry.focusMain, state: "opening" as const, tappedAt: entry.tappedAt }
      : null);

  // A step a tap from this tab named is drawn from that tap, ready and busy (or failed with its
  // retry), until its result moves the screen on, as the frame drew it before this content came: the
  // server's facts (its lesson, the block to do meanwhile) are for the step at rest.
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

/**
 * The end of the day on one screen: what changed, then Today or "10 more minutes". Right after
 * stopping for today, what's done so far, then Today or "Keep going".
 */
export function SessionSummaryClient({
  goalKind,
  isGuest,
  buddy,
  sessionId,
  stopped,
  summary,
}: {
  /** Says the goal's progress its way: preparation for an exam, the way done for the rest. */
  goalKind: SummaryGoalKind;
  /** A guest's first session ends by asking them to save their plan with an account. */
  isGuest: boolean;
  /** Glad about the day's rewards, and named in the milestone when it grows. */
  buddy: LearnerBuddy;
  sessionId: string;
  /** The learner just stopped for today (`?stopped`). */
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
