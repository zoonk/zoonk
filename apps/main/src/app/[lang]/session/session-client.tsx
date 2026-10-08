"use client";

import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useRouter } from "@/i18n/navigation";
import { type LearnerBuddy } from "@/lib/learn/learner-buddy";
import { recordGenerationWaitAction } from "@/lib/lessons/generation-wait-action";
import { useLessonPlayerHref } from "@/lib/lessons/use-lesson-player-href";
import {
  answerStudyQuestionAction,
  finishStudyBlockAction,
} from "@/lib/session/study-session-actions";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { WorkflowRunFollower } from "@/lib/workflow/workflow-run-follower";
import { GenerationFollowerProvider } from "@zoonk/learn/generation/follower";
import { type LessonNotWritten } from "@zoonk/learn/lesson-not-written";
import { QuestionBlock } from "@zoonk/learn/session/block";
import { NextStop, type NextStopLesson } from "@zoonk/learn/session/next-stop";
import { SessionSummary, type SummaryGoalKind } from "@zoonk/learn/session/summary";
import {
  type StudyBlock,
  type StudyBlockDetail,
  type StudySession,
  type StudySessionSummary,
} from "@zoonk/learn/session/types";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useLocale } from "next-intl";

const EXIT_HREF = "/today";
const SIGN_UP_HREF = "/login";

/** A question block of today's session: capsules, practice or a mistake drill. */
export function SessionBlockClient({
  detail,
  session,
}: {
  detail: StudyBlockDetail;
  session: StudySession;
}) {
  const navigation = useStudyNavigation(session.id);
  const lessonHref = useLessonPlayerHref();
  const ids = { blockId: detail.block.id, sessionId: session.id };

  return (
    <QuestionBlock
      actions={{
        answer: (input) =>
          answerStudyQuestionAction({ ...ids, ...input, timeZone: getLocalTimeZone() }),
        continueSession: navigation.continueSession,
        finish: () => finishStudyBlockAction({ ...ids, timeZone: getLocalTimeZone() }),
        stop: navigation.stop,
      }}
      detail={detail}
      exitHref={EXIT_HREF}
      key={detail.block.id}
      lessonHref={lessonHref}
      session={{ blocks: session.blocks, id: session.id, missions: session.missions }}
    />
  );
}

/**
 * The next stop when nothing is open yet, the wait while its lesson is written, following the run
 * writing it live from the API, or why it won't be written now.
 */
export function SessionNextStopClient({
  alternative,
  block,
  generationId,
  lesson,
  notWritten,
  session,
}: {
  alternative: StudyBlock | null;
  block: StudyBlock;
  generationId: string | null;
  lesson: NextStopLesson;
  notWritten: LessonNotWritten | null;
  session: StudySession;
}) {
  const router = useRouter();
  const locale = useLocale();
  const navigation = useStudyNavigation(session.id);

  return (
    <GenerationFollowerProvider follower={WorkflowRunFollower}>
      <NextStop
        actions={{
          recordWait: (milliseconds) =>
            void recordGenerationWaitAction({ contentKind: "lesson", locale, milliseconds }),
          refresh: () => router.refresh(),
          start: navigation.openBlock,
          stop: navigation.stop,
        }}
        alternative={alternative}
        block={block}
        exitHref={EXIT_HREF}
        generationId={generationId}
        lesson={lesson}
        notWritten={notWritten}
        sessionBar={session.sessionBar}
      />
    </GenerationFollowerProvider>
  );
}

/**
 * The end of the day in steps: what changed, then Today or "10 more minutes". Right after stopping
 * for today, what's done so far, then Today or "Keep going".
 */
export function SessionSummaryClient({
  goalKind,
  isGuest,
  buddy,
  sessionId,
  summary,
}: {
  /** Says the goal's progress its way: preparation for an exam, the way done for the rest. */
  goalKind: SummaryGoalKind;
  /** A guest's first session ends by asking them to save their plan with an account. */
  isGuest: boolean;
  /** Glad about the day's rewards, and named in the milestone when it grows. */
  buddy: LearnerBuddy;
  sessionId: string;
  summary: StudySessionSummary;
}) {
  const router = useRouter();
  const navigation = useStudyNavigation(sessionId);

  return (
    <SessionSummary
      actions={{
        addExtraTime: navigation.addExtraTime,
        done: async () => {
          router.push(EXIT_HREF);
          return true;
        },
        keepGoing: navigation.continueSession,
      }}
      buddy={buddy}
      exitHref={EXIT_HREF}
      goalKind={goalKind}
      renderCeremony={(milestone, onClose) => (
        <SessionCeremony buddy={buddy} milestone={milestone} onClose={onClose} />
      )}
      signUpHref={isGuest ? SIGN_UP_HREF : null}
      summary={summary}
    />
  );
}
