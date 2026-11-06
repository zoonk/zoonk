"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { Button } from "@zoonk/ui/components/button";
import { Checkbox } from "@zoonk/ui/components/checkbox";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { PLAN_OPTION_CLASS } from "./plan-option-styles";

type ExamChoicePicksProps = {
  choice: ExamChoiceView;
  disabled: boolean;
  onSave: (subjects: string[]) => void;
};

function Picks({ choice, disabled, onSave }: ExamChoicePicksProps) {
  const t = useExtracted();
  const [draft, setDraft] = useState<string[]>(choice.subjects);
  const isFull = draft.length >= choice.take;

  const isSaved =
    draft.length === choice.subjects.length &&
    draft.every((name) => choice.subjects.includes(name));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {t("Pick up to {take, number}.", { take: choice.take })}
      </p>

      <div className="flex flex-wrap gap-2">
        {choice.options.map((option) => {
          const isPicked = draft.includes(option.name);
          const isDisabled = disabled || (!isPicked && isFull);

          return (
            <label
              className={cn(PLAN_OPTION_CLASS, isDisabled && "cursor-not-allowed opacity-50")}
              key={option.name}
            >
              <Checkbox
                checked={isPicked}
                disabled={isDisabled}
                onCheckedChange={(checked) =>
                  setDraft(
                    checked
                      ? [...draft, option.name]
                      : draft.filter((name) => name !== option.name),
                  )
                }
              />
              {option.shortName ?? option.name}
            </label>
          );
        })}
      </div>

      <Button
        className="self-start"
        disabled={disabled || draft.length === 0 || isSaved}
        focusableWhenDisabled
        onClick={() =>
          onSave(
            choice.options.flatMap((option) => (draft.includes(option.name) ? [option.name] : [])),
          )
        }
        size="sm"
      >
        {t("Save")}
      </Button>
    </div>
  );
}

/**
 * The options of a choice whose candidates take several, saved together so the plan isn't rebuilt
 * on every tick; the draft starts again from the saved pick whenever it changes, as after an undo.
 */
export function ExamChoicePicks(props: ExamChoicePicksProps) {
  return <Picks key={props.choice.subjects.join("\n")} {...props} />;
}
