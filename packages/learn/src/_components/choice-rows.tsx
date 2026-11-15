"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { cn } from "@zoonk/ui/lib/utils";
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

function ChoiceTitle({ choice, markRoom }: { choice: RowChoice<string>; markRoom?: string }) {
  if (!markRoom) {
    return (
      <ListRowTitle className={cn(choice.mark && "flex flex-wrap items-center gap-x-2 gap-y-1")}>
        {choice.label}
        {choice.mark && <Badge variant="outline">{choice.mark}</Badge>}
      </ListRowTitle>
    );
  }

  return (
    <ListRowTitle className="flex gap-x-2">
      <span className="min-w-0">{choice.label}</span>
      <span className={cn("flex h-lh shrink-0 items-center", !choice.mark && "invisible")}>
        <Badge variant="outline">{choice.mark ?? markRoom}</Badge>
      </span>
    </ListRowTitle>
  );
}

export function ChoiceRows<Value extends string>({
  choices,
  label,
  markRoom,
  onChange,
  readOnly = false,
  stackOnPhone = true,
  value,
}: {
  choices: readonly RowChoice<Value>[];
  label: string;
  /**
   * A mark that can come after the first frame, such as a recommendation: every row keeps room for
   * it on its first line, so it moves nothing when it comes.
   */
  markRoom?: string;
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
          data-slot="choice-row"
          key={choice.value}
        >
          <ListRowBody
            className={cn(
              stackOnPhone && "max-sm:gap-y-px max-sm:*:first:max-w-none max-sm:*:first:basis-full",
            )}
          >
            <ListRowContent>
              <ChoiceTitle choice={choice} markRoom={markRoom} />
              {choice.description && <ListRowDescription>{choice.description}</ListRowDescription>}
            </ListRowContent>

            {choice.trailing && <ListRowTrailing>{choice.trailing}</ListRowTrailing>}
          </ListRowBody>

          <RadioGroupItem className="self-center" value={choice.value} />
        </RadioGroupOption>
      ))}
    </RadioGroup>
  );
}
