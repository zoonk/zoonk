import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { type LessonRequest } from "@/lib/lessons/use-lesson-writing";
import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { type getLessonWaitingState } from "@zoonk/core/lookahead/lesson-waiting-state";
import { LessonWaiting } from "./lesson-waiting";

type LessonOutline = { description: string; estimatedMinutes: number; id: string; title: string };

export function LessonWaitingView({
  goalId,
  initialRequest,
  inSession,
  lesson,
  origin,
  waiting,
  warmUp,
}: {
  goalId: string | null;
  initialRequest: LessonRequest;
  inSession: boolean;
  lesson: LessonOutline;
  origin: string | null;
  waiting: Awaited<ReturnType<typeof getLessonWaitingState>> | null;
  warmUp: WarmUpDeck | null;
}) {
  const request: LessonRequest =
    waiting?.status === "ready" && waiting.state.generationId
      ? { generationId: waiting.state.generationId, status: "writing" }
      : initialRequest;

  return (
    <MainLearnProvider>
      <LessonWaiting
        goalId={goalId}
        alternative={waiting?.status === "ready" ? waiting.state.alternative : null}
        exitHref={inSession ? "/today" : (origin ?? "/")}
        initialRequest={request}
        key={request.status === "writing" ? request.generationId : request.status}
        lesson={lesson}
        warmUp={warmUp}
      />
    </MainLearnProvider>
  );
}
