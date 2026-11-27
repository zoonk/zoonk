"use client";

import { MAX_LESSON_QUESTION_LENGTH } from "@zoonk/core/lesson-questions/contract";
import { type HelpLimit, WaitOverStatus } from "@zoonk/learn/help-limit";
import { TUTOR_COMPOSER_FRAME_CLASS } from "@zoonk/learn/tutor-composer";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@zoonk/ui/components/input-group";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowUpIcon, RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type KeyboardEvent, type Ref, useId } from "react";
import { EnterHint } from "../components/enter-hint";
import { type LessonQuestionApiError } from "./lesson-question-api";
import {
  QuestionErrorAction,
  QuestionLimitNotice,
  RequestErrorMessage,
  useQuestionLimit,
} from "./lesson-question-errors";
import { getQuestionRefusal } from "./lesson-question-state-helpers";
import { getComposerAvailability } from "./lesson-question-status";
import { isUsageRefusal } from "./lesson-question-usage";
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

function SubmitIcon({ isResolvingPreviousQuestion }: { isResolvingPreviousQuestion: boolean }) {
  if (isResolvingPreviousQuestion) {
    return <RotateCcwIcon aria-hidden="true" />;
  }

  return <ArrowUpIcon aria-hidden="true" />;
}

type ComposerVariant = "compact" | "page";

const FOCUS_CLASS =
  "has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-foreground/35 contrast-more:has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] contrast-more:has-[[data-slot=input-group-control]:focus-visible]:ring-foreground";

const FRAME_CLASS = cn(TUTOR_COMPOSER_FRAME_CLASS, "items-end rounded-xl! border-0", FOCUS_CLASS);

const ONE_LINE_PLACEHOLDER_CLASS = "placeholder-shown:truncate placeholder:truncate";

const TEXTAREA_MAX_CLASS: Record<ComposerVariant, string> = {
  compact: "max-h-[min(8rem,25dvh)]",
  page: "max-h-40",
};

/** 44px at every width: 16px text on a phone, so it doesn't zoom, takes 2px less padding. */
const TEXTAREA_CLASS = cn(
  "min-h-11 py-2.5 pl-3 text-base md:py-3 md:text-sm",
  ONE_LINE_PLACEHOLDER_CLASS,
);

function ComposerLimit({ limit }: { limit: HelpLimit }) {
  return (
    <div className="mb-4" data-slot="question-composer-limit" role="alert">
      <QuestionLimitNotice limit={limit} />
    </div>
  );
}

export function QuestionComposer({
  avatar,
  className,
  controller,
  inputRef,
  label,
  placeholder,
  variant = "compact",
}: {
  avatar?: React.ReactNode;
  className?: string;
  controller: LessonQuestionController;
  inputRef?: Ref<HTMLTextAreaElement>;
  label?: string;
  placeholder: string;
  variant?: ComposerVariant;
}) {
  const t = useExtracted();
  const inputId = useId();
  const mounted = useIsMounted();
  const { state } = controller;
  const isResolvingPreviousQuestion = controller.unresolvedQuestion !== null;

  const limit = useQuestionLimit(state);
  const isShortBreak = getQuestionRefusal(state)?.kind === "slowDown";

  const { canSend, createNavigationError } = getComposerAvailability({
    isResolvingPreviousQuestion,
    limited: limit !== null,
    state,
  });

  const submitLabel = isResolvingPreviousQuestion ? t("Retry last question") : t("Send");

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (canSend) {
      void controller.send();
    }
  };

  return (
    <div className={className}>
      {limit && <ComposerLimit limit={limit} />}
      {isShortBreak && <WaitOverStatus over={limit === null} />}

      <label className="sr-only" htmlFor={inputId}>
        {label ?? t("Ask a question")}
      </label>
      <InputGroup className={FRAME_CLASS}>
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
          className={cn(TEXTAREA_CLASS, TEXTAREA_MAX_CLASS[variant], avatar && "pl-2")}
          id={inputId}
          maxLength={MAX_LESSON_QUESTION_LENGTH}
          onChange={(event) => controller.changeDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          readOnly={!mounted}
          ref={inputRef}
          value={state.draft}
        />
        <InputGroupAddon align="inline-end" className="py-1.75">
          <InputGroupButton
            aria-label={submitLabel}
            busy={state.creating !== null}
            data-slot="composer-send"
            disabled={!canSend || createNavigationError}
            focusableWhenDisabled
            icon={<SubmitIcon isResolvingPreviousQuestion={isResolvingPreviousQuestion} />}
            onClick={() => void controller.send()}
            size="icon-sm"
            variant="default"
          />
        </InputGroupAddon>
      </InputGroup>

      {state.error === "create" && !isUsageRefusal(state.requestError) && (
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

      {variant === "page" && <EnterHint action="send" className="mt-2" />}
    </div>
  );
}
