"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { MAX_GOAL_LENGTH } from "../entry/goal-entry";
import { TypedGoal } from "../entry/goal-outcomes";

/**
 * What the learner wrote, above what was understood. "Fix something" opens it to change the words,
 * which are then read again from scratch, so every fact on the card follows the new words.
 */
export function UnderstoodWords({
  disabled,
  onCancel,
  onRewrite,
  rewriting,
  words,
}: {
  disabled: boolean;
  onCancel: () => void;
  onRewrite: (words: string) => void;
  rewriting: boolean;
  words: string;
}) {
  const t = useExtracted();
  const inputId = useId();
  const hintId = useId();
  const [value, setValue] = useState(words);
  const trimmed = value.trim();

  if (!rewriting) {
    return <TypedGoal goal={words} />;
  }

  const submit = () => {
    if (trimmed && !disabled) {
      onRewrite(trimmed);
    }
  };

  return (
    <form
      className={cn(
        "bg-muted/60 focus-within:ring-ring/40 flex flex-col gap-3 rounded-3xl p-3 pl-4 focus-within:ring-[3px]",
        "in-data-[mode=fun]:fun-glass",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label
        className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-sm"
        htmlFor={inputId}
      >
        {t("What you wrote")}
      </label>

      <textarea
        aria-describedby={hintId}
        autoFocus
        className="field-sizing-content max-h-48 min-h-11 w-full min-w-0 resize-none bg-transparent text-[17px] leading-snug outline-none"
        id={inputId}
        maxLength={MAX_GOAL_LENGTH}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => {
          // The caret waits at the end of the words, ready to add or change a detail.
          const { length } = event.currentTarget.value;
          event.currentTarget.setSelectionRange(length, length);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onCancel();
          }

          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          }
        }}
        value={value}
      />

      <p className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-sm" id={hintId}>
        {t("We'll read it again. To fix one detail, use its pencil below.")}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button disabled={!trimmed || disabled} size="sm" type="submit">
          {t("Read it again")}
        </Button>
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}
