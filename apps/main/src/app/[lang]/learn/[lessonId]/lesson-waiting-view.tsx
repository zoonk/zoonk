import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import { type getLessonWaitingState } from "@zoonk/core/lookahead/lesson-waiting-state";
import { LessonWaiting } from "./lesson-waiting";

type LessonOutline = { description: string; estimatedMinutes: number; id: string; title: string };

export function LessonWaitingView({
  initialRequest,
  inSession,
  lesson,
  origin,
  waiting,
}: {
  initialRequest: LessonRequest;
  inSession: boolean;
  lesson: LessonOutline;
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
