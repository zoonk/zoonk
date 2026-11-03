"use client";

import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { type TutorCards } from "@zoonk/learn/tutor-cards";
import { TUTOR_COMPOSER_FRAME_CLASS } from "@zoonk/learn/tutor-composer";
import { type TutorIdentity, TutorMessage } from "@zoonk/learn/tutor-identity";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "../activities/_utils/use-reduced-motion";
import { type LessonTutorConfig } from "../lesson/tutor/lesson-tutor-context";
import { QuestionComposer } from "./lesson-question-composer";
import {
  QuestionErrorAction,
  QuestionLimitNotice,
  RequestErrorMessage,
  toHelpLimit,
} from "./lesson-question-errors";
import {
  LessonQuestionNavigationContext,
  useLessonQuestionNavigation,
} from "./lesson-question-navigation";
import {
  LessonQuestionHostProvider,
  useLessonQuestionController,
} from "./lesson-question-provider";
import { isLessonQuestionAnswerInProgress } from "./lesson-question-status";
import { EarlierTurns, QuestionTurn, SENDING_TURN_ID, SendingTurn } from "./lesson-question-turn";
import { ConversationSkeleton, FirstDay, TurnDay } from "./tutor-conversation-parts";
import { ConversationMissionMoment, useConversationMissionMoment } from "./tutor-mission-moment";
import { TutorSuggestions, useOffersSuggestions } from "./tutor-suggestions";
import { type LessonQuestionThreadPage } from "./use-lesson-question-sessions";
import { type LessonQuestionHost } from "./use-lesson-questions";
import { useTurnSignals } from "./use-turn-signals";

type TutorConversationProps = TutorCards & {
  composerLabel: string;
  /** Only seeds the composer; the learner must send it explicitly. */
  draft?: string;
  greeting: string;
  greetingAction?: React.ReactNode;
  identity: TutorIdentity;
  onAnswered?: () => void;
  onAsked?: () => void;
  placeholder: string;
  suggestions: readonly { id: string; label: string }[];
};

const GOAL_CONTEXT = { kind: "plan" } as const;

const TURN_CLASS = "flex scroll-mt-4 flex-col gap-5 lg:scroll-mt-24";

const COMPOSER_POSITION =
  "sticky bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] lg:bottom-0 z-10 -mx-4 bg-linear-to-t from-background from-75% to-transparent px-4 pt-6 pb-3 lg:pb-6";

function LoadError() {
  const controller = useLessonQuestionController();
  const error = controller.state.requestError;
  const limit = toHelpLimit(error);

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

function SignUpPrompt() {
  const t = useExtracted();
  const { loginHref } = useLessonQuestionNavigation();

  return (
    <div className={cn(TUTOR_COMPOSER_FRAME_CLASS, "flex items-center gap-3 py-2 pr-2 pl-3.5")}>
      <p className="text-muted-foreground flex-1 text-sm">
        {t("Create a free account to start the conversation.")}
      </p>
      <a className={buttonVariants({ size: "sm" })} href={loginHref}>
        {t("Create a free account")}
      </a>
    </div>
  );
}

/** Follows a turn added at the end; a saved question taking its sent turn's place stays put. */
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
  const turns = useRef(new Map<string, HTMLElement>());
  const shown = useRef<{ count: number; id: string | null } | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const previous = shown.current;
    shown.current = { count, id: latestId };

    if (previous && (previous.id === latestId || count <= previous.count)) {
      return;
    }

    const turn = latestId ? turns.current.get(latestId) : null;

    turn?.scrollIntoView({
      behavior: previous === null || reducedMotion ? "instant" : "smooth",
      block: "start",
    });
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
}: Pick<TutorConversationProps, "identity" | "renderPlanChange" | "renderToolOffer">) {
  const controller = useLessonQuestionController();
  const { state } = controller;
  const now = useMountTime();
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

function useBroughtQuestion({
  changeDraft,
  draft,
}: {
  changeDraft: (draft: string) => void;
  draft?: string;
}) {
  useEffect(() => {
    if (draft) {
      changeDraft(draft);
    }
  }, [changeDraft, draft]);
}

function ConversationBody({
  composerLabel,
  draft,
  greeting,
  greetingAction,
  identity,
  onAnswered,
  onAsked,
  placeholder,
  renderPlanChange,
  missionMoment,
  renderToolOffer,
  suggestions,
}: TutorConversationProps & { missionMoment: MissionMomentView | null }) {
  const t = useExtracted();
  const controller = useLessonQuestionController();
  const { canAskQuestions, state } = controller;
  const ready = state.loadStatus === "ready" && state.error !== "load";
  const empty = ready && state.questions.length === 0 && !state.creating;
  const offersSuggestions = useOffersSuggestions();

  const answering = state.questions.some((question) => isLessonQuestionAnswerInProgress(question));

  useBroughtQuestion({ changeDraft: controller.changeDraft, draft });
  useTurnSignals({ onAnswered, onAsked });

  return (
    <section
      aria-label={t("Conversation with {name}", { name: identity.name })}
      className="flex flex-1 flex-col"
    >
      <div aria-busy={answering} className="flex flex-1 flex-col gap-5 pb-2" role="log">
        <FirstDay />

        <TutorMessage identity={identity} page>
          <p>{greeting}</p>
          {greetingAction && <div className="flex">{greetingAction}</div>}
        </TutorMessage>

        {canAskQuestions && state.loadStatus !== "ready" && <ConversationSkeleton />}

        {state.error === "load" && <LoadError />}

        {ready && (
          <ConversationTurns
            identity={identity}
            renderPlanChange={renderPlanChange}
            renderToolOffer={renderToolOffer}
          />
        )}

        <ConversationMissionMoment buddyName={identity.name} moment={missionMoment} />
      </div>

      <div className={cn(COMPOSER_POSITION, "flex flex-col gap-2.5")}>
        {empty && canAskQuestions && offersSuggestions && (
          <TutorSuggestions
            onSelect={(suggestion) => void controller.sendSuggestion(suggestion)}
            suggestions={suggestions.map(({ label }) => ({ question: label }))}
          />
        )}

        {canAskQuestions ? (
          <QuestionComposer
            controller={controller}
            label={composerLabel}
            placeholder={placeholder}
            variant="page"
          />
        ) : (
          <SignUpPrompt />
        )}
      </div>
    </section>
  );
}

export function TutorConversation({
  goalId,
  initialThread = null,
  onMissionMoment,
  tutor,
  ...props
}: TutorConversationProps & {
  goalId: string;
  initialThread?: LessonQuestionThreadPage | null;
  onMissionMoment?: (moment: MissionMomentView) => void;
  tutor: LessonTutorConfig;
}) {
  const target = useMemo(() => ({ goalId, kind: "plan" as const }), [goalId]);
  const missionMoment = useConversationMissionMoment({ goalId, onMoment: onMissionMoment });

  const host = useMemo<LessonQuestionHost>(
    () => ({
      activeContext: GOAL_CONTEXT,
      canAskQuestions: tutor.canAsk,
      initialThread,
      lessonStepIds: [],
      onMissionMoment: missionMoment.receive,
      page: true,
      preload: !initialThread,
    }),
    [initialThread, missionMoment.receive, tutor.canAsk],
  );

  return (
    <LessonQuestionNavigationContext value={tutor.navigation}>
      <LessonQuestionHostProvider
        connection={tutor.connection}
        host={host}
        key={goalId}
        target={target}
      >
        <ConversationBody {...props} missionMoment={missionMoment.moment} />
      </LessonQuestionHostProvider>
    </LessonQuestionNavigationContext>
  );
}
