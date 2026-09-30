"use client";

import { MAX_TYPED_ANSWER_LENGTH } from "@zoonk/core/lesson-player/contract";
import { Textarea } from "@zoonk/ui/components/textarea";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { useLessonPlayer } from "../lesson-player-context";
import { CHECK_BOUNDS } from "../use-step-grading";

/** Under the answer: how to answer, that the check is still going, or that it didn't work. */
function AnswerHint({ id }: { id: string }) {
  const t = useExtracted();
  const { state } = useLessonPlayer();

  const isSlow = useTakingLong({
    active: state.phase === "checking",
    afterMs: CHECK_BOUNDS.slowMs,
  });

  function getHint() {
    if (state.checkFailed) {
      return t("We couldn't check your answer this time. Try again.");
    }

    return isSlow
      ? t("Still checking. This is taking longer than usual.")
      : t("Your own words are fine. Press Enter to check, Shift+Enter for a new line.");
  }

  return (
    <p
      aria-live="polite"
      className={cn("text-xs", state.checkFailed ? "text-destructive" : "text-muted-foreground")}
      id={id}
    >
      {getHint()}
    </p>
  );
}

/**
 * A written answer. Enter checks it and Shift+Enter starts a new line, like a chat; once it's
 * checked, Enter continues, as everywhere else. It stays editable after a failed check, so nothing
 * typed is lost.
 */
export function LessonAnswerField({
  isLocked,
  label,
  onChange,
  value,
}: {
  isLocked: boolean;
  label: string;
  onChange: (text: string) => void;
  value: string;
}) {
  const t = useExtracted();
  const hintId = useId();
  const { actions, screen } = useLessonPlayer();

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
    <div className="flex flex-col gap-2">
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

      <AnswerHint id={hintId} />
    </div>
  );
}
