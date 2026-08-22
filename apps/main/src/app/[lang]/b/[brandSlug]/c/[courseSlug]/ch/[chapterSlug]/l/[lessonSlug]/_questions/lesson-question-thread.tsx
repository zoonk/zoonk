"use client";

import { type AppRoute, Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@zoonk/ui/components/message-scroller";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Spinner } from "@zoonk/ui/components/spinner";
import { ArrowDownIcon, MessageSquareTextIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { QuestionErrorAction, RequestErrorMessage } from "./lesson-question-errors";
import { isLessonQuestionAnswerInProgress } from "./lesson-question-status";
import { QuestionTurn } from "./lesson-question-turn";
import { type LessonQuestionController } from "./use-lesson-questions";

function ThreadLoading() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <div className="flex flex-col items-end gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-16 w-3/4 rounded-2xl" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

function ThreadLoadError<Href extends string>({
  error,
  loginHref,
  onRetry,
}: {
  error: LessonQuestionApiError | null;
  loginHref: AppRoute<Href>;
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
        <QuestionErrorAction error={error} loginHref={loginHref} onRetry={onRetry} />
      </EmptyContent>
    </Empty>
  );
}

function EmptyThread({
  contextKind,
  onSelect,
}: {
  contextKind: LessonQuestionController["state"]["context"]["kind"];
  onSelect: (question: string) => void;
}) {
  const t = useExtracted();

  const suggestions =
    contextKind === "answer"
      ? [t("Walk me through this answer"), t("Can you explain the difference?")]
      : [t("Explain this more simply"), t("Give me another example")];

  return (
    <Empty className="min-h-full p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquareTextIcon />
        </EmptyMedia>
        <EmptyTitle className="text-base">{t("What would you like to understand?")}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            size="sm"
            type="button"
            variant="outline"
          >
            {suggestion}
          </Button>
        ))}
      </EmptyContent>
    </Empty>
  );
}

function GuestThread<Href extends string>({ loginHref }: { loginHref: AppRoute<Href> }) {
  const t = useExtracted();

  return (
    <Empty className="min-h-full p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquareTextIcon />
        </EmptyMedia>
        <EmptyTitle className="text-base">{t("Sign in to ask about this lesson")}</EmptyTitle>
        <EmptyDescription>
          {t(
            "Your questions and answers will be saved with the lesson. You can still copy the lesson content.",
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link className={buttonVariants({ variant: "outline" })} href={loginHref} prefetch={false}>
          {t("Sign in")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}

function ThreadViewport({ children, ...props }: React.ComponentProps<"div">) {
  const t = useExtracted();

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
      <MessageScroller>
        <MessageScrollerViewport className="px-4 py-6 sm:px-5" {...props}>
          {children}
        </MessageScrollerViewport>
        <MessageScrollerButton aria-label={t("Scroll to latest question")}>
          <ArrowDownIcon aria-hidden="true" />
        </MessageScrollerButton>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

export function QuestionThread<Href extends string>({
  controller,
  isAuthenticated,
  loginHref,
}: {
  controller: LessonQuestionController;
  isAuthenticated: boolean;
  loginHref: AppRoute<Href>;
}) {
  const t = useExtracted();
  const { state } = controller;

  const answerInProgressCount = state.questions.filter((question) =>
    isLessonQuestionAnswerInProgress(question),
  ).length;

  if (!isAuthenticated) {
    return (
      <ThreadViewport>
        <GuestThread loginHref={loginHref} />
      </ThreadViewport>
    );
  }

  if (state.loadStatus === "loading") {
    return (
      <ThreadViewport>
        <ThreadLoading />
      </ThreadViewport>
    );
  }

  if (state.error === "load") {
    return (
      <ThreadViewport>
        <ThreadLoadError
          error={state.requestError}
          loginHref={loginHref}
          onRetry={() => void controller.load()}
        />
      </ThreadViewport>
    );
  }

  if (state.questions.length === 0) {
    return (
      <ThreadViewport>
        <EmptyThread contextKind={state.context.kind} onSelect={controller.changeDraft} />
      </ThreadViewport>
    );
  }

  return (
    <ThreadViewport
      aria-busy={answerInProgressCount > 0}
      aria-label={t("Lesson questions")}
      role="log"
    >
      <MessageScrollerContent role="presentation">
        {state.hasMore && (
          <MessageScrollerItem className="flex flex-col items-center gap-2">
            {state.earlierLoadFailed && (
              <p className="text-destructive text-center text-sm" role="alert">
                {t("Couldn't load earlier questions. Please try again.")}
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
          </MessageScrollerItem>
        )}
        {state.questions.map((question) => (
          <MessageScrollerItem key={question.id} messageId={question.id} scrollAnchor>
            <QuestionTurn
              activeQuestionId={state.activeQuestionId}
              answerError={state.answerError}
              answerInProgressCount={answerInProgressCount}
              loginHref={loginHref}
              onRetry={(questionId) => void controller.retryAnswer(questionId)}
              question={question}
            />
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </ThreadViewport>
  );
}
