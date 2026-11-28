"use client";

import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { useLiveLimit } from "@zoonk/learn/help-limit";
import { useLearnerClock } from "@zoonk/learn/learner-clock";
import { type TutorCards } from "@zoonk/learn/tutor-cards";
import { type TutorIdentity, TutorMessage } from "@zoonk/learn/tutor-identity";
import { OpenPageHere } from "@zoonk/ui/components/open-page-here";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "../activities/_utils/use-reduced-motion";
import {
  QuestionErrorAction,
  QuestionLimitNotice,
  RequestErrorMessage,
  toHelpLimit,
} from "./lesson-question-errors";
import { useLessonQuestionController } from "./lesson-question-provider";
import { isLessonQuestionAnswerInProgress } from "./lesson-question-status";
import { EarlierTurns, QuestionTurn, SENDING_TURN_ID, SendingTurn } from "./lesson-question-turn";
import { ConversationSkeleton, FirstDay, TurnDay } from "./tutor-conversation-parts";
import { ConversationMissionMoment } from "./tutor-mission-moment";
import { WaitForFirstShow } from "./wait-for-first-show";

export type ConversationLogProps = TutorCards & {
  greeting: string;
  greetingAction?: React.ReactNode;
  identity: TutorIdentity;
};

const TURN_CLASS = "flex scroll-mt-4 flex-col gap-5";

function LoadError() {
  const controller = useLessonQuestionController();
  const error = controller.state.requestError;
  const limit = toHelpLimit(useLiveLimit(error));

  if (limit) {
    return <QuestionLimitNotice limit={limit} />;
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground text-sm">
        <RequestErrorMessage error={error} />
      </p>
      <QuestionErrorAction error={error} onRetry={() => void controller.load()} />
    </div>
  );
}

/**
 * Follows a turn added at the end; a saved question taking its sent turn's place stays put. A
 * server-rendered page already opened at its latest turn, so hydrating it doesn't scroll.
 */
function useFollowLatest({
  count,
  latestId,
  ready,
}: {
  count: number;
  latestId: string | null;
  ready: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const mounted = useIsMounted();
  const turns = useRef(new Map<string, HTMLElement>());

  const shown = useRef<{ count: number; id: string | null } | null>(
    mounted ? null : { count, id: latestId },
  );

  // Next.js keeps a page the learner left mounted but hidden, and scrolls to the top when they come
  // back, so a hidden conversation forgets what it showed and opens at its latest turn again.
  useLayoutEffect(
    () => () => {
      shown.current = null;
    },
    [],
  );

  useLayoutEffect(() => {
    if (!ready) {
      return;
    }

    const previous = shown.current;
    shown.current = { count, id: latestId };

    if (previous && (previous.id === latestId || count <= previous.count)) {
      return;
    }

    const turn = latestId ? turns.current.get(latestId) : null;
    const behavior = previous === null || reducedMotion ? "instant" : "smooth";

    // Before the browser paints, but after Next.js scrolls a page it navigated to, which happens in
    // a parent's layout effect later in this same commit.
    queueMicrotask(() => turn?.scrollIntoView({ behavior, block: "start" }));
  }, [count, latestId, ready, reducedMotion]);

  return (id: string) => (element: HTMLElement | null) => {
    if (element) {
      turns.current.set(id, element);
    } else {
      turns.current.delete(id);
    }
  };
}

function ConversationTurns({
  identity,
  renderPlanChange,
  renderToolOffer,
}: Pick<ConversationLogProps, "identity" | "renderPlanChange" | "renderToolOffer">) {
  const controller = useLessonQuestionController();
  const { state } = controller;
  const { now } = useLearnerClock();
  const last = state.questions.at(-1);
  const latestId = state.creating ? SENDING_TURN_ID : (last?.id ?? null);

  const trackTurn = useFollowLatest({
    count: state.questions.length + (state.creating ? 1 : 0),
    latestId,
    ready: state.loadStatus === "ready",
  });

  return (
    <>
      <EarlierTurns page />

      {state.questions.map((question, index) => (
        <div className={TURN_CLASS} key={question.id} ref={trackTurn(question.id)}>
          <TurnDay
            date={new Date(question.createdAt)}
            previous={index > 0 ? new Date(state.questions[index - 1]?.createdAt ?? 0) : null}
          />
          <QuestionTurn
            identity={identity}
            page
            planChange={
              question.planChange &&
              renderPlanChange({
                change: question.planChange,
                onAnswered: controller.answerPlanChange,
              })
            }
            question={question}
            toolOffer={question.toolOffer && renderToolOffer(question.toolOffer)}
          />
          {question.id === latestId && <OpenPageHere />}
        </div>
      ))}

      {state.creating && (
        <div className={TURN_CLASS} ref={trackTurn(SENDING_TURN_ID)}>
          <TurnDay date={now} previous={last ? new Date(last.createdAt) : null} />
          <SendingTurn identity={identity} page question={state.creating.question} />
        </div>
      )}
    </>
  );
}

export function ConversationLog({
  greeting,
  greetingAction,
  identity,
  missionMoment,
  renderPlanChange,
  renderToolOffer,
}: ConversationLogProps & { missionMoment: MissionMomentView | null }) {
  const { canAskQuestions, state } = useLessonQuestionController();
  const ready = state.loadStatus === "ready" && state.error !== "load";
  const answering = state.questions.some((question) => isLessonQuestionAnswerInProgress(question));

  return (
    <div aria-busy={answering} className="flex flex-1 flex-col gap-5 pb-2" role="log">
      <FirstDay />

      <TutorMessage identity={identity} page>
        <p>{greeting}</p>
        {greetingAction && <div className="flex">{greetingAction}</div>}
      </TutorMessage>

      {canAskQuestions && state.loadStatus !== "ready" && <ConversationSkeleton />}

      {state.error === "load" && <LoadError />}

      {ready && (
        <WaitForFirstShow questions={state.questions}>
          <ConversationTurns
            identity={identity}
            renderPlanChange={renderPlanChange}
            renderToolOffer={renderToolOffer}
          />
        </WaitForFirstShow>
      )}

      <ConversationMissionMoment moment={missionMoment} />
    </div>
  );
}
