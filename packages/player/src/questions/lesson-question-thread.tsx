"use client";

import { type LessonTutorSuggestion } from "@zoonk/core/lesson-questions/contract";
import { type TutorIdentity } from "@zoonk/learn/tutor-identity";
import { buttonVariants } from "@zoonk/ui/components/button";
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
import { QuestionErrorAction, RequestErrorMessage } from "./lesson-question-errors";
import { useLessonQuestionNavigation } from "./lesson-question-navigation";
import { useLessonQuestionController } from "./lesson-question-provider";
import { type OfferedSuggestion } from "./lesson-question-state";
import { isLessonQuestionAnswerInProgress } from "./lesson-question-status";
import {
  ThreadPanel,
  ThreadViewport,
  ThreadViewportSkeleton,
} from "./lesson-question-thread-viewport";
import { EarlierTurns, QuestionTurn, SENDING_TURN_ID, SendingTurn } from "./lesson-question-turn";
import { TutorSuggestions, useOffersSuggestions } from "./tutor-suggestions";
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
    <Empty className="min-h-full">
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

function EmptyThread({
  context,
  identity,
  lessonSuggestions,
  onSelect,
}: {
  context: LessonQuestionController["state"]["context"];
  identity: TutorIdentity;
  lessonSuggestions: readonly LessonTutorSuggestion[] | null;
  onSelect: (suggestion: OfferedSuggestion) => void;
}) {
  const t = useExtracted();

  const offered = useTutorSuggestions({ context, lessonSuggestions: lessonSuggestions ?? [] });

  const suggestions = lessonSuggestions ? offered : [];

  return (
    <Empty className="min-h-full">
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
      <EmptyContent>
        <TutorSuggestions onSelect={onSelect} suggestions={suggestions} />
      </EmptyContent>
    </Empty>
  );
}

function GuestThread() {
  const t = useExtracted();
  const { loginHref } = useLessonQuestionNavigation();

  return (
    <Empty className="min-h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquareTextIcon />
        </EmptyMedia>
        <EmptyTitle className="text-base">{t("Create a free account to ask questions")}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <a className={buttonVariants()} href={loginHref}>
          {t("Create a free account")}
        </a>
      </EmptyContent>
    </Empty>
  );
}

function WaitForFirstShow({
  children,
  questions,
}: {
  children: React.ReactNode;
  questions: LessonQuestionController["state"]["questions"];
}) {
  const [firstQuestions, setFirstQuestions] = useState<typeof questions | null>(questions);

  if (firstQuestions && firstQuestions !== questions) {
    setFirstQuestions(null);
  }

  return <OnDemandWaitContext value={firstQuestions === questions}>{children}</OnDemandWaitContext>;
}

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
        {state.creating && (
          <MessageScrollerItem className="[content-visibility:visible]" messageId={SENDING_TURN_ID}>
            <SendingTurn identity={identity} question={state.creating.question} />
          </MessageScrollerItem>
        )}
      </MessageScrollerContent>
    </ThreadViewport>
  );
}

export function QuestionThread({ identity }: { identity: TutorIdentity }) {
  const controller = useLessonQuestionController();
  const { state } = controller;
  const offersSuggestions = useOffersSuggestions();

  if (!controller.canAskQuestions) {
    return (
      <ThreadPanel>
        <GuestThread />
      </ThreadPanel>
    );
  }

  if (state.loadStatus === "loading") {
    return <ThreadViewportSkeleton />;
  }

  if (state.error === "load") {
    return (
      <ThreadPanel>
        <ThreadLoadError error={state.requestError} onRetry={() => void controller.load()} />
      </ThreadPanel>
    );
  }

  if (state.questions.length === 0 && !state.hasMore && !state.creating) {
    return (
      <ThreadPanel>
        <EmptyThread
          context={state.context}
          identity={identity}
          lessonSuggestions={offersSuggestions ? controller.suggestions : null}
          onSelect={(suggestion) => void controller.sendSuggestion(suggestion)}
        />
      </ThreadPanel>
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
