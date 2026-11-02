"use client";

import { MAX_TYPED_ANSWER_LENGTH } from "@zoonk/core/lesson-player/contract";
import { Input } from "@zoonk/ui/components/input";
import { Textarea } from "@zoonk/ui/components/textarea";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { focusLessonAfterTurn } from "../_utils/lesson-focus";
import { useLessonPlayer } from "../lesson-player-context";
import { CHECK_BOUNDS } from "../use-step-grading";

function AnswerHint({ id, isNumber }: { id: string; isNumber: boolean }) {
  const t = useExtracted();
  const { state } = useLessonPlayer();

  const isSlow = useTakingLong({
    active: state.phase === "checking",
    afterMs: CHECK_BOUNDS.slowMs,
  });

  if (state.checkFailed || isSlow) {
    return (
      <p
        aria-live="polite"
        className={cn(
          "text-xs",
          state.checkFailed ? "text-destructive-text" : "text-muted-foreground",
        )}
        id={id}
      >
        {state.checkFailed
          ? t("We couldn't check your answer this time. Try again.")
          : t("Still checking. This is taking longer than usual.")}
      </p>
    );
  }

  if (isNumber || state.phase !== "playing") {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className="text-muted-foreground hidden text-xs lg:pointer-fine:block"
      id={id}
    >
      {t("Press Enter to check, Shift+Enter for a new line.")}
    </p>
  );
}

export function LessonAnswerField({
  autoFocusOnPointer = false,
  isLocked,
  isNumber = false,
  label,
  onChange,
  value,
}: {
  autoFocusOnPointer?: boolean;
  isLocked: boolean;
  isNumber?: boolean;
  label: string;
  onChange: (text: string) => void;
  value: string;
}) {
  const t = useExtracted();
  const hintId = useId();
  const { actions, screen, state } = useLessonPlayer();
  const fieldRef = useRef<HTMLDivElement>(null);
  const isGraded = state.phase === "feedback";

  useEffect(() => {
    if (autoFocusOnPointer && globalThis.matchMedia("(pointer: fine)").matches) {
      fieldRef.current
        ?.querySelector<HTMLElement>("input, textarea")
        ?.focus({ preventScroll: true });
    }
  }, [autoFocusOnPointer]);

  useEffect(() => {
    if (isGraded && fieldRef.current?.contains(document.activeElement)) {
      focusLessonAfterTurn();
    }
  }, [isGraded]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (!screen.primary || screen.primary.disabled) {
      return;
    }

    if (screen.primary.action === "check") {
      actions.check();
      return;
    }

    actions.continue();
  }

  return (
    <div className="flex flex-col gap-2" ref={fieldRef}>
      {isNumber ? (
        <Input
          aria-describedby={hintId}
          aria-label={label}
          autoComplete="off"
          className="h-12 w-48 text-base tabular-nums sm:text-lg"
          inputMode="decimal"
          maxLength={MAX_TYPED_ANSWER_LENGTH}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("Your answer")}
          readOnly={isLocked}
          value={value}
        />
      ) : (
        <Textarea
          aria-describedby={hintId}
          aria-label={label}
          className="min-h-28 text-base sm:text-lg"
          maxLength={MAX_TYPED_ANSWER_LENGTH}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("Write your answer")}
          readOnly={isLocked}
          value={value}
        />
      )}

      <AnswerHint id={hintId} isNumber={isNumber} />
    </div>
  );
}
