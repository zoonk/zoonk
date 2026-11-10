"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { CHOICE_ROW_CLASS } from "../onboarding/choice-list";
import {
  LIST_GROUP_CLASS,
  ListRowBody,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
  ListRowTrailing,
} from "./list-group";

export type RowChoice<Value extends string> = {
  description?: string;
  label: string;
  mark?: string;
  trailing?: string;
  value: Value;
};

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
          className={cn(CHOICE_ROW_CLASS, "font-normal")}
          data-highlighted={choice.value === value || undefined}
          key={choice.value}
        >
          <ListRowBody className={cn(stackOnPhone && "max-sm:gap-y-px max-sm:*:first:basis-full")}>
            <ListRowContent>
              <ListRowTitle
                className={cn(choice.mark && "flex flex-wrap items-center gap-x-2 gap-y-1")}
              >
                {choice.label}
                {choice.mark && <Badge variant="outline">{choice.mark}</Badge>}
              </ListRowTitle>
              {choice.description && <ListRowDescription>{choice.description}</ListRowDescription>}
            </ListRowContent>

            {choice.trailing && <ListRowTrailing>{choice.trailing}</ListRowTrailing>}
          </ListRowBody>

          <span aria-hidden="true" className="flex size-4 shrink-0 self-center">
            <CheckIcon className="text-selected hidden size-4 group-has-data-checked/choice:block" />
          </span>
          {/* `absolute` replaces the item's own `relative`, which outranks `sr-only` and kept it in the row. */}
          <RadioGroupItem className="sr-only absolute" value={choice.value} />
        </RadioGroupOption>
      ))}
    </RadioGroup>
  );
}
