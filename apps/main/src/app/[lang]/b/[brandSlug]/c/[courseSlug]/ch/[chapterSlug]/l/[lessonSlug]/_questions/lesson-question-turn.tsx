"use client";

import { type AppRoute } from "@/i18n/navigation";
import { type LessonQuestionContextSummary } from "@zoonk/core/lesson-questions/contract";
import { Bubble, BubbleContent } from "@zoonk/ui/components/bubble";
import { Button } from "@zoonk/ui/components/button";
import { Marker, MarkerContent, MarkerIcon } from "@zoonk/ui/components/marker";
import { Message, MessageContent, MessageHeader } from "@zoonk/ui/components/message";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Spinner } from "@zoonk/ui/components/spinner";
import { RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import dynamic from "next/dynamic";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { QuestionErrorAction, RequestErrorMessage } from "./lesson-question-errors";
import { type LessonQuestionController } from "./use-lesson-questions";

function QuestionContextLabel({ context }: { context: LessonQuestionContextSummary }) {
  const t = useExtracted();

  if (context.kind === "answer") {
    return <>{t("About your answer")}</>;
  }

  return <>{t("About this lesson")}</>;
}

function AnswerMarkdownSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 py-1">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

const AnswerMarkdown = dynamic(
  () => import("./lesson-question-markdown").then((module) => module.LessonQuestionMarkdown),
  { loading: AnswerMarkdownSkeleton, ssr: false },
);

function AnswerFailureMessage({ error }: { error: LessonQuestionApiError | null }) {
  const t = useExtracted();

  if (
    error?.kind === "authentication" ||
    error?.kind === "subscription" ||
    error?.kind === "unavailable" ||
    error?.kind === "limit"
  ) {
    return <RequestErrorMessage error={error} />;
  }

  return <>{t("We couldn't finish this answer.")}</>;
}

function QuestionAnswer<Href extends string>({
  answer,
  checkAgainDisabled,
  disabled,
  error,
  isLocallyStreaming,
  loginHref,
  onCheckAgain,
  onRetry,
  status,
}: {
  answer: string | null;
  checkAgainDisabled: boolean;
  disabled: boolean;
  error: LessonQuestionApiError | null;
  isLocallyStreaming: boolean;
  loginHref: AppRoute<Href>;
  onCheckAgain: () => void;
  onRetry: () => void;
  status: "pending" | "running" | "completed" | "failed";
}) {
  const t = useExtracted();

  if (status === "failed") {
    return (
      <div className="flex flex-col items-start gap-3">
        {answer && <AnswerMarkdown answer={answer} isAnimating={false} isStreaming={false} />}
        <p className="text-destructive text-sm">
          <AnswerFailureMessage error={error} />
        </p>
        <QuestionErrorAction
          disabled={disabled}
          error={error}
          loginHref={loginHref}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (answer) {
    return (
      <div className="flex flex-col items-start gap-3">
        <div className="flex w-full items-end gap-2">
          <div className="text-foreground min-w-0 flex-1">
            <AnswerMarkdown
              answer={answer}
              isAnimating={isLocallyStreaming}
              isStreaming={status === "running"}
            />
          </div>
          {status === "running" && (
            <Spinner
              aria-label={t("Answering")}
              className="text-muted-foreground mb-0.5 size-3.5 shrink-0"
            />
          )}
        </div>
        {status === "running" && !isLocallyStreaming && (
          <Button
            disabled={checkAgainDisabled}
            onClick={onCheckAgain}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcwIcon aria-hidden="true" />
            {t("Check again")}
          </Button>
        )}
      </div>
    );
  }

  if (status === "completed") {
    return <p className="text-muted-foreground">{t("No answer available.")}</p>;
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Marker role="status">
        <MarkerIcon>
          <Spinner />
        </MarkerIcon>
        <MarkerContent className="shimmer">{t("Thinking…")}</MarkerContent>
      </Marker>
      {status === "running" && !isLocallyStreaming && (
        <Button
          disabled={checkAgainDisabled}
          onClick={onCheckAgain}
          size="sm"
          type="button"
          variant="outline"
        >
          <RotateCcwIcon aria-hidden="true" />
          {t("Check again")}
        </Button>
      )}
    </div>
  );
}

export function QuestionTurn<Href extends string>({
  activeQuestionId,
  answerInProgressCount,
  answerError,
  loginHref,
  onCheckAgain,
  onRetry,
  question,
}: {
  activeQuestionId: string | null;
  answerInProgressCount: number;
  answerError: LessonQuestionController["state"]["answerError"];
  loginHref: AppRoute<Href>;
  onCheckAgain: (questionId: string) => void;
  onRetry: (questionId: string) => void;
  question: LessonQuestionController["state"]["questions"][number];
}) {
  const t = useExtracted();

  return (
    <article aria-label={t("Your question")} className="flex flex-col gap-3">
      <Message align="end">
        <MessageContent>
          <MessageHeader>
            <QuestionContextLabel context={question.context} />
          </MessageHeader>
          <Bubble align="end" variant="muted">
            <BubbleContent>{question.question}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>

      <Message>
        <MessageContent>
          <Bubble variant="ghost">
            <BubbleContent>
              <QuestionAnswer
                answer={question.answer}
                checkAgainDisabled={activeQuestionId !== null || answerInProgressCount > 1}
                disabled={activeQuestionId !== null || answerInProgressCount > 0}
                error={answerError?.questionId === question.id ? answerError.reason : null}
                isLocallyStreaming={activeQuestionId === question.id}
                loginHref={loginHref}
                onCheckAgain={() => onCheckAgain(question.id)}
                onRetry={() => onRetry(question.id)}
                status={question.status}
              />
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    </article>
  );
}
