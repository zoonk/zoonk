"use client";

import { MAX_LESSON_QUESTION_LENGTH } from "@zoonk/core/lesson-questions/contract";
import { type HelpLimit } from "@zoonk/learn/help-limit";
import { TUTOR_COMPOSER_FRAME_CLASS } from "@zoonk/learn/tutor-composer";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@zoonk/ui/components/input-group";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowUpIcon, RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type KeyboardEvent, type Ref, useEffect, useId, useRef } from "react";
import { type LessonQuestionApiError } from "./lesson-question-api";
import {
  QuestionErrorAction,
  QuestionLimitNotice,
  RequestErrorMessage,
  getQuestionLimit,
} from "./lesson-question-errors";
import { doesLessonQuestionBlockNewQuestion } from "./lesson-question-status";
import { type LessonQuestionController } from "./use-lesson-questions";

function ComposerError({
  isResolvingPreviousQuestion,
  requestError,
}: {
  isResolvingPreviousQuestion: boolean;
  requestError: LessonQuestionApiError | null;
}) {
  const t = useExtracted();

  if (requestError?.kind === "unknown" && isResolvingPreviousQuestion) {
    return <>{t("We couldn't send your last question. Try again.")}</>;
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

const CREATE_NAVIGATION_ERROR_KINDS = new Set(["authentication", "subscription", "unavailable"]);

type ComposerVariant = "compact" | "page";

const FOCUS_CLASS =
  "has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-foreground/35 contrast-more:has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] contrast-more:has-[[data-slot=input-group-control]:focus-visible]:ring-foreground";

const FRAME_CLASS: Record<ComposerVariant, string> = {
  compact: cn(
    "bg-card ring-input rounded-option! items-end border-0 ring-1 ring-inset",
    FOCUS_CLASS,
  ),
  page: cn(
    TUTOR_COMPOSER_FRAME_CLASS,
    "items-end rounded-[0.875rem]! border-transparent",
    FOCUS_CLASS,
  ),
};

const LIMIT_FRAME_CLASS: Record<ComposerVariant, string> = {
  compact: "bg-card ring-input rounded-option ring-1 ring-inset",
  page: TUTOR_COMPOSER_FRAME_CLASS,
};

const ONE_LINE_PLACEHOLDER_CLASS = "placeholder-shown:truncate placeholder:truncate";

const TEXTAREA_CLASS: Record<ComposerVariant, string> = {
  compact: cn("max-h-32 min-h-11 py-3 pl-3 text-base md:text-sm", ONE_LINE_PLACEHOLDER_CLASS),
  page: cn(
    "max-h-40 min-h-12 py-3 pl-3.5 text-[0.9375rem] md:text-[0.9375rem]",
    ONE_LINE_PLACEHOLDER_CLASS,
  ),
};

const SEND_ADDON_CLASS: Record<ComposerVariant, string> = { compact: "py-1.75", page: "pb-2.25" };

function useComposerPlaceholder(contextKind: LessonQuestionController["state"]["context"]["kind"]) {
  const t = useExtracted();

  switch (contextKind) {
    case "chapter":
      return t("Ask about this chapter…");
    case "mock":
      return t("Ask about this mock exam…");
    case "plan":
      return t("Ask about your plan…");
    case "subject":
      return t("Ask about this subject…");
    case "item":
      return t("Ask about this question…");
    case "answer":
      return t("Ask about your answer…");
    case "lesson":
    case "step":
      return t("Ask about the lesson content…");
    default:
      return contextKind satisfies never;
  }
}

function getComposerAvailability({
  isResolvingPreviousQuestion,
  state,
}: {
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

  const isReady = state.loadStatus === "ready";
  const hasQuestionToSend = Boolean(state.draft.trim()) || isResolvingPreviousQuestion;

  return {
    canSend: isReady && !isBusy && !createNavigationError && hasQuestionToSend,
    createNavigationError,
  };
}

function ComposerLimit({ limit, variant }: { limit: HelpLimit; variant: ComposerVariant }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (document.activeElement === document.body) {
      ref.current?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <div
      className={cn(
        LIMIT_FRAME_CLASS[variant],
        "focus-visible:outline-ring flex min-h-11 items-center py-2 pr-2 pl-3.5 outline-none focus-visible:outline-2 focus-visible:outline-solid",
      )}
      data-slot="question-composer-limit"
      ref={ref}
      role="alert"
      tabIndex={-1}
    >
      <QuestionLimitNotice
        className="flex-1 flex-row items-center justify-between gap-3 [&>p]:min-w-0"
        limit={limit}
      />
    </div>
  );
}

export function QuestionComposer({
  avatar,
  className,
  controller,
  inputRef,
  label,
  placeholder: hostPlaceholder,
  variant = "compact",
}: {
  avatar?: React.ReactNode;
  className?: string;
  controller: LessonQuestionController;
  inputRef?: Ref<HTMLTextAreaElement>;
  label?: string;
  placeholder?: string;
  variant?: ComposerVariant;
}) {
  const t = useExtracted();
  const inputId = useId();
  const { state } = controller;
  const isResolvingPreviousQuestion = controller.unresolvedQuestion !== null;

  const { canSend, createNavigationError } = getComposerAvailability({
    isResolvingPreviousQuestion,
    state,
  });

  const limit = getQuestionLimit(state);
  const submitLabel = isResolvingPreviousQuestion ? t("Retry last question") : t("Send");
  const contextPlaceholder = useComposerPlaceholder(state.context.kind);
  const placeholder = hostPlaceholder ?? contextPlaceholder;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || !canSend) {
      return;
    }

    event.preventDefault();
    void controller.send();
  };

  if (limit) {
    return (
      <div className={className}>
        <ComposerLimit limit={limit} variant={variant} />
      </div>
    );
  }

  return (
    <div className={className}>
      <label className="sr-only" htmlFor={inputId}>
        {label ?? t("Ask a question")}
      </label>
      <InputGroup className={FRAME_CLASS[variant]}>
        {avatar && (
          <InputGroupAddon align="inline-start" className="pr-0 pb-2.75 pl-2.5">
            <span
              aria-hidden="true"
              className="flex size-5.5 items-center justify-center *:size-5.5!"
            >
              {avatar}
            </span>
          </InputGroupAddon>
        )}
        <InputGroupTextarea
          className={cn(TEXTAREA_CLASS[variant], avatar && "pl-2")}
          id={inputId}
          maxLength={MAX_LESSON_QUESTION_LENGTH}
          onChange={(event) => controller.changeDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={inputRef}
          value={state.draft}
        />
        <InputGroupAddon align="inline-end" className={SEND_ADDON_CLASS[variant]}>
          <InputGroupButton
            aria-label={submitLabel}
            className="size-7.5 rounded-lg"
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

      {state.error === "create" && (
        <p className="text-destructive-text mt-2 text-sm" role="alert">
          <ComposerError
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
            onRetry={() => void controller.send()}
          />
        </div>
      )}

      {variant === "page" && (
        <p className="text-faint mt-2 hidden px-1 font-mono text-[0.6875rem] leading-4 pointer-fine:block">
          {t("⏎ send · ⇧⏎ new line")}
        </p>
      )}
    </div>
  );
}
