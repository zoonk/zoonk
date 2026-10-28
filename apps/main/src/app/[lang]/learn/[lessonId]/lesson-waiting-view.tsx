import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import { type getLessonWaitingState } from "@zoonk/core/lookahead/lesson-waiting-state";
import { LessonWaiting } from "./lesson-waiting";

type LessonOutline = { description: string; estimatedMinutes: number; id: string; title: string };

/**
 * Follows writing already requested, or offers the one action that starts it. The page reads the
 * lesson's state (`waiting`, an active run from an earlier visit included) with its other data, so
 * the view renders with them in one pass.
 */
export function LessonWaitingView({
  initialRequest,
  inSession,
  lesson,
  origin,
  waiting,
}: {
  initialRequest: LessonRequest;
  /** Opened from today's session, so going back returns to Today. */
  inSession: boolean;
  lesson: LessonOutline;
  /** The catalog page a visitor opened it from, which going back returns to. */
  origin: string | null;
  waiting: Awaited<ReturnType<typeof getLessonWaitingState>> | null;
}) {
  const request: LessonRequest =
    waiting?.status === "ready" && waiting.state.generationId
      ? { generationId: waiting.state.generationId, status: "writing" }
      : initialRequest;

  return (
    <LessonWaiting
      alternative={waiting?.status === "ready" ? waiting.state.alternative : null}
      exitHref={inSession ? "/today" : (origin ?? "/")}
      initialRequest={request}
      key={request.status === "writing" ? request.generationId : request.status}
      lesson={lesson}
    />
  );
}
