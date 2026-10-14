"use client";

import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useQuestionTutor } from "@/components/learn/use-question-tutor";
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
          openWrittenLesson: navigation.openWrittenLesson,
          recordWait: (milliseconds) =>
            void recordGenerationWaitAction({ contentKind: "lesson", locale, milliseconds }),
          refresh: () => router.refresh(),
          start: navigation.openBlock,
          stop: navigation.stop,
        }}
        alternative={alternative}
        block={block}
        blocks={session.blocks}
        exitHref={EXIT_HREF}
        generationId={generationId}
        lesson={lesson}
        lessonsComing={session.lessonsComing}
        notWritten={notWritten}
        sessionBar={session.sessionBar}
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
