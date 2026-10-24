"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { CHOICE_ROW_CLASS } from "../onboarding/choice-list";
import {
  LIST_GROUP_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
  ListRowTrailing,
} from "./list-group";

/** One option to pick: its name, what it means under it, and its size at its end. */
export type RowChoice<Value extends string> = {
  description?: string;
  label: string;
  /** A word beside the name, as a chip ("Recommended"). */
  mark?: string;
  /** The size in the mono face ("90 q · ~4h 42m", "5 h"). */
  trailing?: string;
  value: Value;
};

/**
 * One option from a short list (a mock, how to study prerequisites), as flat rows with hairlines
 * between them, like every list: the name, what it means in a quiet line and its size in the mono
 * face at the end. The picked row is highlighted a little past the column with a check, and a tap
 * anywhere on a row picks it. With long names (`stackOnPhone`), a phone puts the size under the
 * name, which then keeps the row's width instead of wrapping word by word. One radio group for
 * assistive tech; number keys pick from it, unless another list on the screen owns them
 * (`numberKeys`). `readOnly` keeps the pick as it is while it can't change (a save in flight).
 */
export function ChoiceRows<Value extends string>({
  choices,
  label,
  numberKeys = true,
  onChange,
  readOnly = false,
  stackOnPhone = true,
  value,
}: {
  choices: readonly RowChoice<Value>[];
  label: string;
  numberKeys?: boolean;
  onChange: (value: Value) => void;
  readOnly?: boolean;
  stackOnPhone?: boolean;
  value: Value | null;
}) {
  const pickAt = (index: number) => {
    const choice = choices[index];

    if (choice && !readOnly) {
      onChange(choice.value);
    }
  };

  useNumberKeys({ count: choices.length, enabled: numberKeys, onPick: pickAt });

  return (
    <RadioGroup
      aria-label={label}
      className={cn(LIST_GROUP_CLASS, "gap-0")}
      onValueChange={(next) => pickAt(choices.findIndex((choice) => choice.value === next))}
      readOnly={readOnly}
      value={value}
    >
      {choices.map((choice) => (
        <RadioGroupOption
          className={cn(
            CHOICE_ROW_CLASS,
            "font-normal",
            stackOnPhone && "max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-y-0",
          )}
          data-highlighted={choice.value === value || undefined}
          key={choice.value}
        >
          <ListRowContent
            className={cn(stackOnPhone && choice.trailing && "max-sm:min-h-0 max-sm:pb-0")}
          >
            <ListRowTitle
              className={cn(choice.mark && "flex flex-wrap items-center gap-x-2 gap-y-1")}
            >
              {choice.label}
              {choice.mark && <Badge variant="outline">{choice.mark}</Badge>}
            </ListRowTitle>
            {choice.description && <ListRowDescription>{choice.description}</ListRowDescription>}
          </ListRowContent>

          {choice.trailing && (
            <ListRowTrailing
              className={cn(
                stackOnPhone && "max-sm:col-start-1 max-sm:self-start max-sm:pt-px max-sm:pb-2.75",
              )}
            >
              {choice.trailing}
            </ListRowTrailing>
          )}

          {/* The pick is the row's highlight and its check; the radio itself stays unseen. */}
          <span
            aria-hidden="true"
            className={cn(
              "flex size-4 shrink-0 self-center",
              stackOnPhone && "max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1",
            )}
          >
            <CheckIcon className="text-selected hidden size-4 group-has-data-checked/choice:block" />
          </span>
          <RadioGroupItem className="sr-only" value={choice.value} />
        </RadioGroupOption>
      ))}
    </RadioGroup>
  );
}
