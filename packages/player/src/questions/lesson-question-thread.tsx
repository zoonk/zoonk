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
import { OnDemandWaitContext } from "@zoonk/ui/lib/on-demand";
import { MessageSquareTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Suspense, useState } from "react";
import { type LessonQuestionApiError } from "./lesson-question-api";
import {
  QuestionErrorAction,
  RequestErrorMessage,
  getQuestionLimit,
} from "./lesson-question-errors";
import { useLessonQuestionNavigation } from "./lesson-question-navigation";
import { useLessonQuestionController } from "./lesson-question-provider";
import { type OfferedSuggestion } from "./lesson-question-state";
import { isLessonQuestionAnswerInProgress } from "./lesson-question-status";
import { ThreadViewport, ThreadViewportSkeleton } from "./lesson-question-thread-viewport";
import { EarlierTurns, QuestionTurn } from "./lesson-question-turn";
import { type LessonQuestionController } from "./use-lesson-questions";
import { useTutorSuggestions } from "./use-tutor-suggestions";

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
    case "subject":
      return t("Questions about this subject");
    case "item":
      return t("Questions about this question");
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
  context,
  identity,
  lessonSuggestions,
  onSelect,
}: {
  context: LessonQuestionController["state"]["context"];
  identity: TutorIdentity;
  /** None once the learner's help is used up: nothing could be sent. */
  lessonSuggestions: readonly LessonTutorSuggestion[] | null;
  onSelect: (suggestion: OfferedSuggestion) => void;
}) {
  const t = useExtracted();

  const offered = useTutorSuggestions({ context, lessonSuggestions: lessonSuggestions ?? [] });

  const suggestions = lessonSuggestions ? offered : [];

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
          {t("{name} is an AI study buddy and can make mistakes.", { name: identity.name })}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap">
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

/**
 * The answers' renderer loads with the first conversation that has any (usually ahead of time, see
 * `preloadTutorMarkdown`). Until it and the answers' math or diagrams are here, the thread keeps
 * its loading look rather than showing raw Markdown. Once shown it never goes back to it: answers
 * that change later (a new one, earlier ones) draw as soon as they can.
 */
function WaitForFirstShow({
  children,
  questions,
}: {
  children: React.ReactNode;
  questions: LessonQuestionController["state"]["questions"];
}) {
  // The questions it opened with; null once they change, which means the thread has shown.
  const [firstQuestions, setFirstQuestions] = useState<typeof questions | null>(questions);

  if (firstQuestions && firstQuestions !== questions) {
    setFirstQuestions(null);
  }

  return <OnDemandWaitContext value={firstQuestions === questions}>{children}</OnDemandWaitContext>;
}

/** The thread's questions and answers, with the way to earlier ones. */
function ThreadTurns({ identity }: { identity: TutorIdentity }) {
  const { renderPlanChange, renderToolOffer } = useLessonQuestionNavigation();
  const { answerPlanChange, state } = useLessonQuestionController();
  const threadLabel = useThreadLabel(state.context.kind);

  return (
    <ThreadViewport
      aria-busy={state.questions.some(isLessonQuestionAnswerInProgress)}
      aria-label={threadLabel}
      revealedQuestionId={state.revealedQuestionId}
      role="log"
    >
      <MessageScrollerContent role="presentation">
        <EarlierTurns />
        {/* Real message heights keep bottom-following stable as streamed content grows. */}
        {state.questions.map((question) => (
          <MessageScrollerItem
            className="[content-visibility:visible]"
            key={question.id}
            messageId={question.id}
          >
            <QuestionTurn
              identity={identity}
              planChange={
                question.planChange &&
                renderPlanChange?.({ change: question.planChange, onAnswered: answerPlanChange })
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

/** The tutor's conversation, by `identity`, the buddy who answers, by face and name. */
export function QuestionThread({ identity }: { identity: TutorIdentity }) {
  const controller = useLessonQuestionController();
  const { state } = controller;

  if (!controller.canAskQuestions) {
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

  // A latest page whose turns wait for the question's check keeps the way to earlier ones.
  if (state.questions.length === 0 && !state.hasMore) {
    return (
      <ThreadViewport>
        <EmptyThread
          context={state.context}
          identity={identity}
          lessonSuggestions={getQuestionLimit(state) ? null : controller.suggestions}
          onSelect={(suggestion) => void controller.sendSuggestion(suggestion)}
        />
      </ThreadViewport>
    );
  }

  return (
    <Suspense fallback={<ThreadViewportSkeleton />}>
      <WaitForFirstShow questions={state.questions}>
        <ThreadTurns identity={identity} />
      </WaitForFirstShow>
    </Suspense>
  );
}
