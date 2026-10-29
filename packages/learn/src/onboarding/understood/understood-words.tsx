"use client";

import { MAX_GOAL_PROMPT_LENGTH } from "@zoonk/core/goals/goal-input-limits";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { GOAL_PANEL_CLASS } from "../entry/goal-field";
import { TypedGoal } from "../entry/goal-outcomes";

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
      className={cn(GOAL_PANEL_CLASS, "flex flex-col gap-3 p-3 pl-4")}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="text-muted-foreground text-sm" htmlFor={inputId}>
        {t("What you wrote")}
      </label>

      <textarea
        aria-describedby={hintId}
        autoFocus
        className="field-sizing-content max-h-48 min-h-11 w-full min-w-0 resize-none bg-transparent text-[17px] leading-snug outline-none"
        id={inputId}
        maxLength={MAX_GOAL_PROMPT_LENGTH}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => {
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

      <p className="text-muted-foreground text-sm" id={hintId}>
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
