import { LearnerWitness } from "@/components/learner/learner-witness";
import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import { getLessonWaitingState } from "@zoonk/core/lookahead/lesson-waiting-state";
import { LessonWaiting } from "./lesson-waiting";

type LessonOutline = { description: string; estimatedMinutes: number; id: string; title: string };

/**
 * Follows writing already requested, or offers the one action that starts it. Loading this view
 * only reads the lesson's state, including an active run from an earlier visit.
 */
export async function LessonWaitingView({
  initialRequest,
  inSession,
  lesson,
  origin,
}: {
  initialRequest: LessonRequest;
  /** Opened from today's session, so going back returns to Today. */
  inSession: boolean;
  lesson: LessonOutline;
  /** The catalog page a visitor opened it from, which going back returns to. */
  origin: string | null;
}) {
  const waiting = await getLessonWaitingState({ lessonId: lesson.id });

  const request: LessonRequest =
    waiting.status === "ready" && waiting.state.generationId
      ? { generationId: waiting.state.generationId, status: "writing" }
      : initialRequest;

  return (
    <>
      <LearnerWitness />

      <LessonWaiting
        alternative={waiting.status === "ready" ? waiting.state.alternative : null}
        exitHref={inSession ? "/today" : (origin ?? "/")}
        initialRequest={request}
        key={request.status === "writing" ? request.generationId : request.status}
        lesson={lesson}
      />
    </>
  );
}
