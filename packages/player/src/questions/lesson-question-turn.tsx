"use client";

import { type LessonQuestionContextSummary } from "@zoonk/core/lesson-questions/contract";
import { Bubble, BubbleContent } from "@zoonk/ui/components/bubble";
import { Button } from "@zoonk/ui/components/button";
import { Marker, MarkerContent } from "@zoonk/ui/components/marker";
import { Message, MessageContent, MessageHeader } from "@zoonk/ui/components/message";
import { RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { QuestionErrorAction, RequestErrorMessage } from "./lesson-question-errors";
import { LessonQuestionMarkdown } from "./lesson-question-markdown";
import { type LessonQuestionController } from "./use-lesson-questions";

function QuestionContextLabel({ context }: { context: LessonQuestionContextSummary }) {
  const t = useExtracted();

  if (context.kind === "answer") {
    return <>{t("About your answer")}</>;
  }

  return <>{t("About this lesson")}</>;
}

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

function QuestionAnswer({
  answer,
  checkAgainDisabled,
  disabled,
  error,
  isLocallyStreaming,
  onCheckAgain,
  onRetry,
  status,
}: {
  answer: string | null;
  checkAgainDisabled: boolean;
  disabled: boolean;
  error: LessonQuestionApiError | null;
  isLocallyStreaming: boolean;
  onCheckAgain: () => void;
  onRetry: () => void;
  status: "pending" | "running" | "completed" | "failed";
}) {
  const t = useExtracted();

  if (status === "failed") {
    return (
      <div className="flex flex-col items-start gap-3">
        {answer && (
          <LessonQuestionMarkdown answer={answer} isAnimating={false} isStreaming={false} />
        )}
        <p className="text-destructive text-sm">
          <AnswerFailureMessage error={error} />
        </p>
        <QuestionErrorAction disabled={disabled} error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (answer) {
    return (
      <div className="flex flex-col items-start gap-3">
        <div className="text-foreground w-full min-w-0">
          <LessonQuestionMarkdown
            answer={answer}
            isAnimating={isLocallyStreaming}
            isStreaming={status === "running"}
          />
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

export function QuestionTurn({
  activeQuestionId,
  answerInProgressCount,
  answerError,
  onCheckAgain,
  onRetry,
  question,
}: {
  activeQuestionId: string | null;
  answerInProgressCount: number;
  answerError: LessonQuestionController["state"]["answerError"];
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
