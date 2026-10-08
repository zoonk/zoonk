import { getLessonWaitingState } from "@zoonk/core/lookahead/lesson-waiting-state";
import { LessonWaiting } from "./lesson-waiting";

type LessonOutline = { description: string; estimatedMinutes: number; id: string; title: string };

/**
 * A lesson that isn't written yet gets written now, on a live screen with a ready alternative. A
 * visitor presses "Start this lesson" first and becomes a guest when the writing is requested, so
 * the lesson they asked for is never a dead end and loading the page alone never writes it.
 */
export async function LessonWaitingView({
  hasSession,
  inSession,
  lesson,
}: {
  hasSession: boolean;
  /** Opened from today's session, so going back returns to Today. */
  inSession: boolean;
  lesson: LessonOutline;
}) {
  const waiting = await getLessonWaitingState({ lessonId: lesson.id });

  return (
    <LessonWaiting
      alternative={waiting.status === "ready" ? waiting.state.alternative : null}
      exitHref={inSession ? "/today" : "/"}
      hasSession={hasSession}
      lesson={lesson}
    />
  );
}
