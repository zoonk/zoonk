"use client";

import {
  type LessonQuestionContextSummary,
  type LessonQuestionMemoryChange,
} from "@zoonk/core/lesson-questions/contract";
import { type TutorIdentity, TutorMessage } from "@zoonk/learn/tutor-identity";
import { Bubble, BubbleContent } from "@zoonk/ui/components/bubble";
import { Button } from "@zoonk/ui/components/button";
import {
  LearnerBubble,
  Message,
  MessageContent,
  MessageHeader,
} from "@zoonk/ui/components/message";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { QuestionAnswer, Thinking } from "./lesson-question-answer";
import { type LessonQuestionContext } from "./lesson-question-context";
import { useLessonQuestionNavigation } from "./lesson-question-navigation";
import { useLessonQuestionController } from "./lesson-question-provider";
import { isLessonQuestionAnswerInProgress } from "./lesson-question-status";
import { type LessonQuestionController } from "./use-lesson-questions";

function QuestionContextLabel({
  context,
}: {
  context: LessonQuestionContext | LessonQuestionContextSummary;
}) {
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

function MemoryUpdate({ changes }: { changes: LessonQuestionMemoryChange[] | undefined }) {
  const { renderMemoryUpdate } = useLessonQuestionNavigation();

  if (!changes || changes.length === 0 || !renderMemoryUpdate) {
    return null;
  }

  return renderMemoryUpdate(changes);
}

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
        focusableWhenDisabled
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

function Turn({
  about,
  answer,
  children,
  identity,
  page,
  question,
}: {
  about: LessonQuestionContext | LessonQuestionContextSummary;
  answer: React.ReactNode;
  children?: React.ReactNode;
  identity: TutorIdentity;
  page: boolean;
  question: string;
}) {
  const t = useExtracted();

  return (
    <article
      aria-label={t({
        description: "Label of the field where the learner types a question.",
        message: "Your question",
      })}
      className={cn("flex flex-col", page ? "gap-5" : "gap-3")}
    >
      <Message align="end">
        <MessageContent>
          {!page && (
            <MessageHeader>
              <QuestionContextLabel context={about} />
            </MessageHeader>
          )}
          <LearnerBubble>{question}</LearnerBubble>
        </MessageContent>
      </Message>

      <TutorMessage identity={identity} page={page}>
        <Bubble variant="ghost">
          <BubbleContent className={cn(page && "text-[0.9375rem] leading-[1.55]")}>
            {answer}
          </BubbleContent>
        </Bubble>
        {children}
      </TutorMessage>
    </article>
  );
}

export const SENDING_TURN_ID = "sending";

export function SendingTurn({
  identity,
  page = false,
  question,
}: {
  identity: TutorIdentity;
  page?: boolean;
  question: string;
}) {
  const { state } = useLessonQuestionController();

  return (
    <Turn
      about={state.context}
      answer={<Thinking />}
      identity={identity}
      page={page}
      question={question}
    />
  );
}

export function QuestionTurn({
  identity,
  page = false,
  planChange,
  question,
  toolOffer,
}: {
  identity: TutorIdentity;
  page?: boolean;
  planChange?: React.ReactNode;
  question: LessonQuestionController["state"]["questions"][number];
  toolOffer?: React.ReactNode;
}) {
  const { checkAnswer, retryAnswer, state } = useLessonQuestionController();
  const { activeQuestionId, answerError } = state;
  const answering = state.questions.filter(isLessonQuestionAnswerInProgress).length;

  return (
    <Turn
      about={question.context}
      answer={
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
      }
      identity={identity}
      page={page}
      question={question.question}
    >
      {(question.answer || question.status !== "running") && (
        <>
          {planChange}
          {toolOffer}
        </>
      )}
      <MemoryUpdate changes={state.memoryChanges[question.id]} />
    </Turn>
  );
}
