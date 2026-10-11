"use client";

import { type LessonTutorSuggestion } from "@zoonk/core/lesson-questions/contract";
import { type TutorIdentity } from "@zoonk/learn/tutor-identity";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { MessageScrollerContent, MessageScrollerItem } from "@zoonk/ui/components/message-scroller";
import { Spinner } from "@zoonk/ui/components/spinner";
import { MessageSquareTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { QuestionErrorAction, RequestErrorMessage } from "./lesson-question-errors";
import { useLessonQuestionNavigation } from "./lesson-question-navigation";
import { type OfferedSuggestion } from "./lesson-question-state";
import { isLessonQuestionAnswerInProgress } from "./lesson-question-status";
import { ThreadViewport, ThreadViewportSkeleton } from "./lesson-question-thread-viewport";
import { QuestionTurn } from "./lesson-question-turn";
import { type LessonQuestionController } from "./use-lesson-questions";

function ThreadLoadError({
  error,
  onRetry,
}: {
  error: LessonQuestionApiError | null;
  onRetry: () => void;
}) {
  return (
    <Empty className="min-h-full p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquareTextIcon />
        </EmptyMedia>
        <EmptyDescription>
          <RequestErrorMessage error={error} />
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <QuestionErrorAction error={error} onRetry={onRetry} />
      </EmptyContent>
    </Empty>
  );
}

/** A lesson's suggestions as chips: their words are the server's, and a tap sends their id. */
function toOffered(suggestions: readonly LessonTutorSuggestion[]): OfferedSuggestion[] {
  return suggestions.map(({ id, label }) => ({ question: label, suggestion: id }));
}

/**
 * The buddy's suggested questions for what the learner is asking about; a few, never a list. In a
 * lesson they are what the old "Simpler" and "Go deeper" buttons did, as questions to the buddy,
 * worded by the server in the lesson's payload so the chip reads what the thread will.
 */
function useSuggestions({
  contextKind,
  lessonSuggestions,
}: {
  contextKind: LessonQuestionController["state"]["context"]["kind"];
  lessonSuggestions: readonly LessonTutorSuggestion[];
}): OfferedSuggestion[] {
  const t = useExtracted();

  switch (contextKind) {
    case "answer":
      return [
        { question: t("Walk me through this answer") },
        ...toOffered(lessonSuggestions.filter(({ id }) => id === "simpler")),
      ];
    case "chapter":
      return [{ question: t("What will I be able to do after this chapter?") }];
    case "lesson":
    case "step":
      return toOffered(lessonSuggestions);
    case "mock":
      return [
        { question: t("What should I practice first?") },
        { question: t("Why did I miss these questions?") },
      ];
    case "plan":
      return [
        { question: t("Why am I studying this today?") },
        { question: t("What comes next?") },
      ];
    default:
      return contextKind satisfies never;
  }
}

/** The conversation's name for screen readers, by what it's about. */
function useThreadLabel(contextKind: LessonQuestionController["state"]["context"]["kind"]) {
  const t = useExtracted();

  switch (contextKind) {
    case "chapter":
      return t("Questions about this chapter");
    case "mock":
      return t("Questions about this mock exam");
    case "plan":
      return t("Questions about your plan");
    case "answer":
    case "lesson":
    case "step":
      return t("Questions about this lesson");
    default:
      return contextKind satisfies never;
  }
}

/**
 * The buddy's hello before the first question, saying it's an AI that can be wrong, with questions
 * to send in one tap.
 */
function EmptyThread({
  contextKind,
  identity,
  lessonSuggestions,
  onSelect,
}: {
  contextKind: LessonQuestionController["state"]["context"]["kind"];
  identity: TutorIdentity;
  lessonSuggestions: readonly LessonTutorSuggestion[];
  onSelect: (suggestion: OfferedSuggestion) => void;
}) {
  const t = useExtracted();
  const suggestions = useSuggestions({ contextKind, lessonSuggestions });

  return (
    <Empty className="min-h-full p-6">
      <EmptyHeader>
        <EmptyMedia aria-hidden="true" className="[&_svg]:size-auto">
          <span className="flex size-12 items-center justify-center *:size-12!">
            {identity.avatar}
          </span>
        </EmptyMedia>
        <EmptyTitle className="text-base">{t("What would you like help with?")}</EmptyTitle>
        <EmptyDescription>
          {t("{name} is an AI tutor and can make mistakes.", { name: identity.name })}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        {suggestions.map((suggestion) => (
          <Button
            className="h-auto min-h-8 py-1.5 whitespace-normal"
            key={suggestion.question}
            onClick={() => onSelect(suggestion)}
            size="sm"
            type="button"
            variant="outline"
          >
            {suggestion.question}
          </Button>
        ))}
      </EmptyContent>
    </Empty>
  );
}

function GuestThread() {
  const t = useExtracted();
  const { linkComponent: Link, loginHref } = useLessonQuestionNavigation();

  return (
    <Empty className="min-h-full p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquareTextIcon />
        </EmptyMedia>
        <EmptyTitle className="text-base">{t("Create a free account to ask questions")}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Link className={buttonVariants()} href={loginHref} prefetch={false}>
          {t("Create a free account")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}

export function QuestionThread({
  controller,
  identity,
  isAuthenticated,
}: {
  controller: LessonQuestionController;
  /** The buddy who answers, by face and name. */
  identity: TutorIdentity;
  isAuthenticated: boolean;
}) {
  const t = useExtracted();
  const { renderPlanChange, renderToolOffer } = useLessonQuestionNavigation();
  const { state } = controller;
  const threadLabel = useThreadLabel(state.context.kind);

  const answerInProgressCount = state.questions.filter((question) =>
    isLessonQuestionAnswerInProgress(question),
  ).length;

  if (!isAuthenticated) {
    return (
      <ThreadViewport>
        <GuestThread />
      </ThreadViewport>
    );
  }

  if (state.loadStatus === "loading") {
    return <ThreadViewportSkeleton />;
  }

  if (state.error === "load") {
    return (
      <ThreadViewport>
        <ThreadLoadError error={state.requestError} onRetry={() => void controller.load()} />
      </ThreadViewport>
    );
  }

  if (state.questions.length === 0) {
    return (
      <ThreadViewport>
        <EmptyThread
          contextKind={state.context.kind}
          identity={identity}
          lessonSuggestions={controller.suggestions}
          onSelect={(suggestion) => void controller.sendSuggestion(suggestion)}
        />
      </ThreadViewport>
    );
  }

  return (
    <ThreadViewport
      aria-busy={answerInProgressCount > 0}
      aria-label={threadLabel}
      revealedQuestionId={state.revealedQuestionId}
      role="log"
    >
      <MessageScrollerContent role="presentation">
        {state.hasMore && (
          <div className="flex flex-col items-center gap-2">
            {state.earlierLoadFailed && (
              <p className="text-destructive text-center text-sm" role="alert">
                {t("Couldn't load earlier questions. Try again.")}
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
              {t("Load earlier questions")}
            </Button>
          </div>
        )}
        {/* Real message heights keep bottom-following stable as streamed content grows. */}
        {state.questions.map((question) => (
          <MessageScrollerItem
            className="[content-visibility:visible]"
            key={question.id}
            messageId={question.id}
          >
            <QuestionTurn
              activeQuestionId={state.activeQuestionId}
              answerError={state.answerError}
              answerInProgressCount={answerInProgressCount}
              identity={identity}
              memoryChanges={state.memoryChanges[question.id]}
              onCheckAgain={(questionId) => void controller.checkAnswer(questionId)}
              onRetry={(questionId) => void controller.retryAnswer(questionId)}
              planChange={
                question.planChange &&
                renderPlanChange?.({
                  change: question.planChange,
                  onAnswered: controller.answerPlanChange,
                })
              }
              question={question}
              toolOffer={question.toolOffer && renderToolOffer?.(question.toolOffer)}
            />
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </ThreadViewport>
  );
}
