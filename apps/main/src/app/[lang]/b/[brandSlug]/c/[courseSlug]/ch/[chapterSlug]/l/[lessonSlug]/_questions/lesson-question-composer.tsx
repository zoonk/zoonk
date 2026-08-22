"use client";

import { type AppRoute } from "@/i18n/navigation";
import { MAX_LESSON_QUESTION_LENGTH } from "@zoonk/core/lesson-questions/contract";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@zoonk/ui/components/input-group";
import { Spinner } from "@zoonk/ui/components/spinner";
import { ArrowUpIcon, RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type KeyboardEvent } from "react";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { QuestionErrorAction, RequestErrorMessage } from "./lesson-question-errors";
import { doesLessonQuestionBlockNewQuestion } from "./lesson-question-status";
import { type LessonQuestionController } from "./use-lesson-questions";

function ComposerError({
  error,
  isResolvingPreviousQuestion,
  requestError,
}: {
  error: "copy" | "create";
  isResolvingPreviousQuestion: boolean;
  requestError: LessonQuestionApiError | null;
}) {
  const t = useExtracted();

  if (error === "copy") {
    return <>{t("Couldn't copy the lesson content. Please try again.")}</>;
  }

  if (requestError?.kind === "unknown" && isResolvingPreviousQuestion) {
    return <>{t("We couldn't confirm the previous question. Retry it before sending another.")}</>;
  }

  return <RequestErrorMessage error={requestError} />;
}

function SubmitIcon({
  isCreating,
  isResolvingPreviousQuestion,
}: {
  isCreating: boolean;
  isResolvingPreviousQuestion: boolean;
}) {
  if (isCreating) {
    return <Spinner aria-hidden="true" />;
  }

  if (isResolvingPreviousQuestion) {
    return <RotateCcwIcon aria-hidden="true" />;
  }

  return <ArrowUpIcon aria-hidden="true" />;
}

const CREATE_NAVIGATION_ERROR_KINDS = new Set([
  "authentication",
  "limit",
  "subscription",
  "unavailable",
]);

const LESSON_QUESTION_COMPOSER_ID = "lesson-question-composer";

function getComposerAvailability({
  isAuthenticated,
  isResolvingPreviousQuestion,
  state,
}: {
  isAuthenticated: boolean;
  isResolvingPreviousQuestion: boolean;
  state: LessonQuestionController["state"];
}) {
  const isBusy =
    state.activeQuestionId !== null ||
    state.isCreating ||
    state.isRefreshing ||
    state.questions.some(doesLessonQuestionBlockNewQuestion);

  const createNavigationError =
    state.error === "create" &&
    Boolean(state.requestError && CREATE_NAVIGATION_ERROR_KINDS.has(state.requestError.kind));

  const isReady = !isAuthenticated || state.loadStatus === "ready";
  const hasGenerationLimit = state.answerError?.reason.kind === "limit";
  const hasQuestionToSend = Boolean(state.draft.trim()) || isResolvingPreviousQuestion;

  return {
    canSend:
      isAuthenticated &&
      isReady &&
      !isBusy &&
      !createNavigationError &&
      !hasGenerationLimit &&
      hasQuestionToSend,
    createNavigationError,
  };
}

export function QuestionComposer({
  controller,
  isAuthenticated,
  loginHref,
}: {
  controller: LessonQuestionController;
  isAuthenticated: boolean;
  loginHref: AppRoute<string>;
}) {
  const t = useExtracted();
  const { state } = controller;
  const isResolvingPreviousQuestion = controller.unresolvedQuestion !== null;

  const { canSend, createNavigationError } = getComposerAvailability({
    isAuthenticated,
    isResolvingPreviousQuestion,
    state,
  });

  const submitLabel = isResolvingPreviousQuestion ? t("Retry previous question") : t("Send");

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || !canSend) {
      return;
    }

    event.preventDefault();
    void controller.send();
  };

  return (
    <div className="bg-background border-t px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
      <label className="sr-only" htmlFor={LESSON_QUESTION_COMPOSER_ID}>
        {t("Ask a question")}
      </label>
      <InputGroup>
        <InputGroupTextarea
          className="max-h-40 min-h-20"
          id={LESSON_QUESTION_COMPOSER_ID}
          maxLength={MAX_LESSON_QUESTION_LENGTH}
          onChange={(event) => controller.changeDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("Ask about the lesson content…")}
          value={state.draft}
        />
        <InputGroupAddon align="block-end" className="justify-end pt-0">
          <InputGroupButton
            aria-label={submitLabel}
            disabled={!canSend || createNavigationError}
            onClick={() => void controller.send()}
            size="icon-sm"
            variant="default"
          >
            <SubmitIcon
              isCreating={state.isCreating}
              isResolvingPreviousQuestion={isResolvingPreviousQuestion}
            />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {(state.error === "create" || state.error === "copy") && (
        <p className="text-destructive mt-2 text-sm" role="alert">
          <ComposerError
            error={state.error}
            isResolvingPreviousQuestion={isResolvingPreviousQuestion}
            requestError={state.requestError}
          />
        </p>
      )}

      {createNavigationError && (
        <div className="mt-3">
          <QuestionErrorAction
            className="w-full"
            error={state.requestError}
            loginHref={loginHref}
            onRetry={() => void controller.send()}
          />
        </div>
      )}
    </div>
  );
}
