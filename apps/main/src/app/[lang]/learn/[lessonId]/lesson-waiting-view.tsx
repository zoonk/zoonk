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
  const state = waiting?.status === "ready" ? waiting.state : null;

  return (
    <MainLearnProvider>
      <LessonWaiting
        goalId={goalId}
        alternative={state?.alternative ?? null}
        beingWritten={state?.status === "generating"}
        exitHref={inSession ? "/today" : (origin ?? "/")}
        initialRequest={initialRequest}
        key={
          initialRequest.status === "writing" ? initialRequest.generationId : initialRequest.status
        }
        kind={state?.kind ?? "lesson"}
        lesson={lesson}
        warmUp={warmUp}
      />
    </MainLearnProvider>
  );
}
