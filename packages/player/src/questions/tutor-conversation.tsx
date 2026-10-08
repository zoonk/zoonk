"use client";

import { type TutorToolOffer } from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type TutorIdentity, TutorMessage } from "@zoonk/learn/tutor-identity";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "../activities/_utils/use-reduced-motion";
import { type LessonTutorConfig } from "../lesson/tutor/lesson-tutor-context";
import { QuestionComposer } from "./lesson-question-composer";
import { QuestionErrorAction, RequestErrorMessage } from "./lesson-question-errors";
import {
  LessonQuestionNavigationContext,
  useLessonQuestionNavigation,
} from "./lesson-question-navigation";
import {
  LessonQuestionHostProvider,
  useLessonQuestionController,
} from "./lesson-question-provider";
import { isLessonQuestionAnswerInProgress } from "./lesson-question-status";
import { QuestionTurn, TUTOR_BUBBLE_CLASS } from "./lesson-question-turn";
import { FirstDay, Suggestions, TurnDay, type TutorSuggestion } from "./tutor-conversation-parts";
import { type LessonQuestionThreadPage } from "./use-lesson-question-sessions";
import { type LessonQuestionHost } from "./use-lesson-questions";

/** How the host draws a plan change an answer proposed, and tells the conversation how it went. */
type RenderPlanChange = (input: {
  change: PlanChangeView;
  onAnswered: (change: PlanChangeView) => void;
}) => React.ReactNode;

/** How the host draws one of the app's tools an answer offered, with the button that opens it. */
type RenderToolOffer = (offer: TutorToolOffer) => React.ReactNode;

type TutorConversationProps = {
  /** What the composer is called for screen readers, such as "Message Zu". */
  composerLabel: string;
  /** The tutor's hello, always the conversation's first message. */
  greeting: string;
  identity: TutorIdentity;
  placeholder: string;
  renderPlanChange: RenderPlanChange;
  renderToolOffer: RenderToolOffer;
  /** Up to three questions the learner can send with one tap before the first message. */
  suggestions: readonly TutorSuggestion[];
};

const GOAL_CONTEXT = { kind: "plan" } as const;

/**
 * The composer is always at the bottom of the screen, however short the conversation: under `lg`
 * right above the tab bar (4rem tall plus its border and the home indicator), from `lg` at the
 * screen's bottom edge.
 */
const COMPOSER_POSITION =
  "sticky bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] lg:bottom-0 z-10 -mx-4 bg-linear-to-t from-background from-75% to-transparent px-4 pt-6 pb-3 lg:pb-6";

function ConversationSkeleton() {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" role="status">
        {t("Loading the conversation…")}
      </p>
      <div aria-hidden="true" className="flex flex-col items-end gap-2">
        <Skeleton className="h-12 w-3/5 rounded-2xl" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

function SignUpPrompt() {
  const t = useExtracted();
  const { linkComponent: Link, loginHref } = useLessonQuestionNavigation();

  return (
    <div className="bg-card flex flex-col gap-3 rounded-3xl border p-4 shadow-sm sm:flex-row sm:items-center">
      <p className="flex-1 text-sm font-medium">
        {t("Create a free account to start the conversation.")}
      </p>
      <Link className={buttonVariants()} href={loginHref} prefetch={false}>
        {t("Create a free account")}
      </Link>
    </div>
  );
}

/**
 * A question the learner just sent moves to the top, so its answer has the room to come in under
 * it; the latest exchange is in view when the conversation opens.
 */
function useFollowLatest({ latestId, ready }: { latestId: string | null; ready: boolean }) {
  const reducedMotion = useReducedMotion();
  const turns = useRef(new Map<string, HTMLElement>());
  const shown = useRef<{ id: string | null } | null>(null);

  useEffect(() => {
    if (!ready || (shown.current && shown.current.id === latestId)) {
      return;
    }

    const opening = shown.current === null;
    shown.current = { id: latestId };
    const turn = latestId ? turns.current.get(latestId) : null;

    turn?.scrollIntoView({
      behavior: opening || reducedMotion ? "instant" : "smooth",
      block: "start",
    });
  }, [latestId, ready, reducedMotion]);

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
  const t = useExtracted();
  const controller = useLessonQuestionController();
  const { state } = controller;
  const latestId = state.questions.at(-1)?.id ?? null;
  const trackTurn = useFollowLatest({ latestId, ready: state.loadStatus === "ready" });

  const answering = state.questions.filter((question) =>
    isLessonQuestionAnswerInProgress(question),
  ).length;

  return (
    <>
      {state.hasMore && (
        <div className="flex flex-col items-center gap-2">
          {state.earlierLoadFailed && (
            <p className="text-destructive text-center text-sm" role="alert">
              {t("Couldn't load earlier messages. Try again.")}
            </p>
          )}
          <Button
            disabled={state.isLoadingEarlier}
            onClick={() => void controller.loadEarlier()}
            size="sm"
            type="button"
            variant="outline"
          >
            {state.isLoadingEarlier && <Spinner aria-hidden="true" />}
            {t("Load earlier messages")}
          </Button>
        </div>
      )}

      {state.questions.map((question, index) => (
        <div
          className="flex scroll-mt-4 flex-col gap-6 lg:scroll-mt-24"
          key={question.id}
          ref={trackTurn(question.id)}
        >
          <TurnDay
            date={new Date(question.createdAt)}
            previous={index > 0 ? new Date(state.questions[index - 1]?.createdAt ?? 0) : null}
          />
          <QuestionTurn
            activeQuestionId={state.activeQuestionId}
            answerError={state.answerError}
            answerInProgressCount={answering}
            identity={identity}
            memoryChanges={state.memoryChanges[question.id]}
            onCheckAgain={(questionId) => void controller.checkAnswer(questionId)}
            onRetry={(questionId) => void controller.retryAnswer(questionId)}
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
    </>
  );
}

function ConversationBody({
  composerLabel,
  greeting,
  identity,
  placeholder,
  renderPlanChange,
  renderToolOffer,
  suggestions,
}: TutorConversationProps) {
  const t = useExtracted();
  const controller = useLessonQuestionController();
  const { canAskQuestions, state } = controller;
  const ready = state.loadStatus === "ready" && state.error !== "load";
  const empty = ready && state.questions.length === 0;

  const answering = state.questions.some((question) => isLessonQuestionAnswerInProgress(question));

  return (
    <section
      aria-label={t("Conversation with {name}", { name: identity.name })}
      className="flex flex-1 flex-col"
    >
      <div aria-busy={answering} className="flex flex-1 flex-col gap-6 pb-2" role="log">
        <FirstDay />

        <TutorMessage identity={identity} page>
          <p className={cn(TUTOR_BUBBLE_CLASS, "w-fit")}>{greeting}</p>
        </TutorMessage>

        {canAskQuestions && state.loadStatus !== "ready" && <ConversationSkeleton />}

        {state.error === "load" && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground text-sm">
              <RequestErrorMessage error={state.requestError} />
            </p>
            <QuestionErrorAction
              error={state.requestError}
              onRetry={() => void controller.load()}
            />
          </div>
        )}

        {ready && (
          <ConversationTurns
            identity={identity}
            renderPlanChange={renderPlanChange}
            renderToolOffer={renderToolOffer}
          />
        )}
      </div>

      <div className={cn(COMPOSER_POSITION, "flex flex-col gap-3")}>
        {empty && canAskQuestions && (
          <Suggestions
            onSend={(question) => void controller.sendSuggestion(question)}
            suggestions={suggestions}
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

/**
 * The learner's conversation with their tutor about one goal, as a page: the tutor's hello, their
 * messages and its answers (with the plan changes it proposed and the app tools it offered, drawn
 * by the host), a few
 * suggestions to start, and a composer that stays within reach. Signed-in learners talk;
 * visitors and guests are asked to create an account. It's the same tutor as the lesson's, over
 * the goal's thread in the public API.
 *
 * ```tsx
 * <TutorConversation goalId={goal.id} identity={{ avatar, name: "Zu" }} tutor={tutor} ... />
 * ```
 *
 * A host that read the thread on the server passes it as `initialThread`: the conversation shows
 * at once, and the latest is still read again in the background.
 */
export function TutorConversation({
  goalId,
  initialThread = null,
  tutor,
  ...props
}: TutorConversationProps & {
  goalId: string;
  initialThread?: LessonQuestionThreadPage | null;
  tutor: LessonTutorConfig;
}) {
  const target = useMemo(() => ({ goalId, kind: "plan" as const }), [goalId]);

  const host = useMemo<LessonQuestionHost>(
    () => ({
      activeContext: GOAL_CONTEXT,
      canAskQuestions: tutor.canAsk,
      initialThread,
      lessonStepIds: [],
      page: true,
      preload: true,
    }),
    [initialThread, tutor.canAsk],
  );

  // Each goal has its own thread: another goal starts its conversation from its own history.
  return (
    <LessonQuestionNavigationContext value={tutor.navigation}>
      <LessonQuestionHostProvider
        connection={tutor.connection}
        host={host}
        key={goalId}
        target={target}
      >
        <ConversationBody {...props} />
      </LessonQuestionHostProvider>
    </LessonQuestionNavigationContext>
  );
}
