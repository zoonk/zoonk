"use client";

import {
  type LessonQuestionContextSummary,
  type LessonQuestionMemoryChange,
} from "@zoonk/core/lesson-questions/contract";
import { type TutorIdentity, TutorMessage } from "@zoonk/learn/tutor-identity";
import { Bubble, BubbleContent } from "@zoonk/ui/components/bubble";
import { Button } from "@zoonk/ui/components/button";
import { Marker, MarkerContent } from "@zoonk/ui/components/marker";
import {
  LearnerBubble,
  Message,
  MessageContent,
  MessageHeader,
} from "@zoonk/ui/components/message";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { QuestionErrorAction, RequestErrorMessage, toHelpLimit } from "./lesson-question-errors";
import { LessonQuestionMarkdown } from "./lesson-question-markdown";
import { useLessonQuestionNavigation } from "./lesson-question-navigation";
import { useLessonQuestionController } from "./lesson-question-provider";
import { isLessonQuestionAnswerInProgress } from "./lesson-question-status";
import { type TutorAnswerLinks } from "./tutor-markdown";
import { type LessonQuestionController } from "./use-lesson-questions";

function QuestionContextLabel({ context }: { context: LessonQuestionContextSummary }) {
  const t = useExtracted();

  switch (context.kind) {
    case "answer":
      return t("About your answer");
    case "chapter":
      return t("About this chapter");
    case "lesson":
      return t("About this lesson");
    case "mock":
      return t("About this mock exam");
    case "plan":
      return t("About your plan");
    case "step":
      return t("About this part");
    case "subject":
      return t("About this subject");
    case "item":
      return context.answered ? t("About your answer") : t("About this question");
    default:
      return context satisfies never;
  }
}

function AnswerFailureMessage({ error }: { error: LessonQuestionApiError | null }) {
  const t = useExtracted();

  if (
    error?.kind === "authentication" ||
    error?.kind === "subscription" ||
    error?.kind === "unavailable" ||
    error?.kind === "slowDown"
  ) {
    return <RequestErrorMessage error={error} />;
  }

  return <>{t("We couldn't finish this answer.")}</>;
}

/**
 * How a buddy answer links the app on this host: only a finished answer whose saved text arrived,
 * or was read from the server (`linksVerified`), links anything.
 */
function useAnswerLinks({
  linksVerified,
  status,
}: {
  linksVerified: boolean;
  status: "pending" | "running" | "completed" | "failed";
}): TutorAnswerLinks | undefined {
  const { appLinks, linkComponent } = useLessonQuestionNavigation();
  const verified = linksVerified && status === "completed";

  return useMemo(
    () => (appLinks ? { Link: linkComponent, openBlock: appLinks.openBlock, verified } : undefined),
    [appLinks, linkComponent, verified],
  );
}

function QuestionAnswer({
  answer,
  checkAgainDisabled,
  disabled,
  error,
  isLocallyStreaming,
  linksVerified,
  onCheckAgain,
  onRetry,
  status,
}: {
  answer: string | null;
  checkAgainDisabled: boolean;
  disabled: boolean;
  error: LessonQuestionApiError | null;
  isLocallyStreaming: boolean;
  linksVerified: boolean;
  onCheckAgain: () => void;
  onRetry: () => void;
  status: "pending" | "running" | "completed" | "failed";
}) {
  const t = useExtracted();
  const limit = toHelpLimit(error);
  const appLinks = useAnswerLinks({ linksVerified, status });

  if (status === "pending" && !isLocallyStreaming) {
    return (
      <Button
        disabled={checkAgainDisabled}
        onClick={onRetry}
        size="sm"
        type="button"
        variant="outline"
      >
        {t("Get answer")}
      </Button>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col items-start gap-3">
        {answer && (
          <LessonQuestionMarkdown
            answer={answer}
            appLinks={appLinks}
            isAnimating={false}
            isStreaming={false}
          />
        )}
        {limit ? (
          // Why, and the one thing to do about it, take the composer's place under the thread.
          <p className="text-muted-foreground text-sm">{t("This one wasn't answered.")}</p>
        ) : (
          <>
            <p className="text-destructive-text text-sm">
              <AnswerFailureMessage error={error} />
            </p>
            <QuestionErrorAction disabled={disabled} error={error} onRetry={onRetry} />
          </>
        )}
      </div>
    );
  }

  if (answer) {
    return (
      <div className="flex flex-col items-start gap-3">
        <div className="text-foreground w-full min-w-0">
          <LessonQuestionMarkdown
            answer={answer}
            appLinks={appLinks}
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

function MemoryUpdate({ changes }: { changes: LessonQuestionMemoryChange[] | undefined }) {
  const { renderMemoryUpdate } = useLessonQuestionNavigation();

  if (!changes || changes.length === 0 || !renderMemoryUpdate) {
    return null;
  }

  return renderMemoryUpdate(changes);
}

/**
 * The way to the conversation's earlier turns, while it has more, saying so when they couldn't be
 * read. A page (the buddy tab) calls them messages.
 */
export function EarlierTurns({ page = false }: { page?: boolean }) {
  const t = useExtracted();
  const { loadEarlier, state } = useLessonQuestionController();

  if (!state.hasMore) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {state.earlierLoadFailed && (
        <p className="text-destructive-text text-center text-sm" role="alert">
          {page
            ? t("Couldn't load earlier messages. Try again.")
            : t("Couldn't load earlier questions. Try again.")}
        </p>
      )}
      <Button
        disabled={state.isLoadingEarlier}
        onClick={() => void loadEarlier()}
        size="sm"
        type="button"
        variant="outline"
      >
        {state.isLoadingEarlier && <Spinner aria-hidden="true" />}
        {page ? t("Load earlier messages") : t("Load earlier questions")}
      </Button>
    </div>
  );
}

/**
 * One question and the buddy's answer, from the tutor's state: its answer's text links the app
 * only as the server saved it (read from the server, or its saved text arrived after it streamed
 * here, see `streamedAnswerIds`).
 */
export function QuestionTurn({
  identity,
  page = false,
  planChange,
  question,
  toolOffer,
}: {
  /** The buddy who answers: its face and name beside every answer. */
  identity: TutorIdentity;
  /**
   * The conversation is a page of its own (the buddy tab): messages read at body size and leave
   * out what each question is about, since it's always the goal.
   */
  page?: boolean;
  /** The plan change the answer proposed, drawn by the host under the answer. */
  planChange?: React.ReactNode;
  question: LessonQuestionController["state"]["questions"][number];
  /** The app tool the answer offered, drawn by the host under the answer. */
  toolOffer?: React.ReactNode;
}) {
  const t = useExtracted();
  const { checkAnswer, retryAnswer, state } = useLessonQuestionController();
  const { activeQuestionId, answerError } = state;
  const answering = state.questions.filter(isLessonQuestionAnswerInProgress).length;

  return (
    <article
      aria-label={t("Your question")}
      className={cn("flex flex-col", page ? "gap-5" : "gap-3")}
    >
      <Message align="end">
        <MessageContent>
          {!page && (
            <MessageHeader>
              <QuestionContextLabel context={question.context} />
            </MessageHeader>
          )}
          <LearnerBubble>{question.question}</LearnerBubble>
        </MessageContent>
      </Message>

      <TutorMessage identity={identity} page={page}>
        <Bubble variant="ghost">
          <BubbleContent className={cn(page && "text-[0.9375rem] leading-[1.55]")}>
            <QuestionAnswer
              answer={question.answer}
              checkAgainDisabled={activeQuestionId !== null || answering > 1}
              disabled={activeQuestionId !== null || answering > 0}
              error={answerError?.questionId === question.id ? answerError.reason : null}
              isLocallyStreaming={activeQuestionId === question.id}
              linksVerified={!state.streamedAnswerIds.includes(question.id)}
              onCheckAgain={() => void checkAnswer(question.id)}
              onRetry={() => void retryAnswer(question.id)}
              status={question.status}
            />
          </BubbleContent>
        </Bubble>
        {/* The card comes with the words that say it, never alone under "Thinking…". */}
        {(question.answer || question.status !== "running") && (
          <>
            {planChange}
            {toolOffer}
          </>
        )}
        <MemoryUpdate changes={state.memoryChanges[question.id]} />
      </TutorMessage>
    </article>
  );
}
