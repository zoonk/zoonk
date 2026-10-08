"use client";

import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import {
  LIST_GROUP_CLASS,
  LIST_ROW_INTERACTIVE_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";

export type Choice<Value extends string> = {
  description?: string;
  icon?: React.ReactNode;
  label: string;
  value: Value;
};

/**
 * A choice's radio or checkbox at its row's end, drawn as every list marks what's done: an empty
 * ring, filled with a check once picked. The row is its label, so a tap anywhere on it picks it.
 */
export const CHOICE_CONTROL_CLASS =
  "border-foreground/15 data-checked:border-primary data-checked:bg-primary size-6 self-center rounded-full border-2 dark:bg-transparent [&_svg]:size-3.5";

/** A radio as a row's check: the ring, and a check over it once picked (its dot left out). */
function ChoiceRadio<Value extends string>({ value }: { value: Value }) {
  return (
    <span className="relative flex shrink-0 self-center">
      <RadioGroupItem
        className={cn(CHOICE_CONTROL_CLASS, "**:data-[slot=radio-group-indicator]:hidden")}
        value={value}
      />
      <CheckIcon
        aria-hidden="true"
        className="text-primary-foreground pointer-events-none absolute inset-0 m-auto hidden size-3.5 group-has-data-checked/choice:block"
        strokeWidth={3}
      />
    </span>
  );
}

/** A choice as a row of one grouped list: the whole row picks it, the keyboard ring inside it. */
export const CHOICE_ROW_CLASS = cn(
  LIST_ROW_INTERACTIVE_CLASS,
  "group/choice has-focus-visible:ring-ring/50 cursor-pointer has-focus-visible:ring-[3px] has-focus-visible:ring-inset",
);

const CHIP_CLASS = cn(
  "border-border bg-card flex cursor-pointer items-center rounded-2xl border transition-colors motion-reduce:transition-none",
  "hover:bg-muted/60 has-data-checked:border-foreground has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
);

/**
 * How the options sit: `rows` for answers with their own short explanation, `chips` for a short
 * list of plain values (amounts of time), several to a row.
 */
type ChoiceListVariant = "chips" | "rows";

/**
 * One answer from a short list: the rows of one grouped list, each with its own short explanation
 * and a check at its end once picked, or compact chips for plain values. Number keys pick an
 * option, unless another list on the screen owns them.
 */
export function ChoiceList<Value extends string>({
  choices,
  label,
  numberKeys = true,
  onChange,
  value,
  variant = "rows",
}: {
  choices: Choice<Value>[];
  label: string;
  /** Off for a second list on the same screen: number keys pick from the first. */
  numberKeys?: boolean;
  onChange: (value: Value) => void;
  value: Value | null;
  variant?: ChoiceListVariant;
}) {
  // Number keys pick an option, so the keyboard answers as fast as a tap.
  useNumberKeys({
    count: choices.length,
    enabled: numberKeys,
    onPick: (index) => {
      const choice = choices[index];

      if (choice) {
        onChange(choice.value);
      }
    },
  });

  const pick = (next: unknown) => {
    const choice = choices.find((item) => item.value === next);

    if (choice) {
      onChange(choice.value);
    }
  };

  if (variant === "chips") {
    return (
      <RadioGroup
        aria-label={label}
        className="grid grid-cols-4 gap-2"
        onValueChange={pick}
        value={value}
      >
        {choices.map((choice) => (
          <RadioGroupOption
            className={cn(
              CHIP_CLASS,
              "has-data-checked:bg-foreground has-data-checked:text-background relative min-h-12 justify-center px-1 py-2 text-center",
            )}
            key={choice.value}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium tabular-nums">{choice.label}</span>
              {/* A chip's note follows its color, so it reads on the picked chip's fill too. */}
              {choice.description && (
                <span className="text-[0.6875rem] leading-tight font-normal opacity-75">
                  {choice.description}
                </span>
              )}
            </span>

            {/* A chip shows it's picked by its fill; its radio, invisible, still takes focus. */}
            <RadioGroupItem
              className="pointer-events-none absolute inset-0 size-full opacity-0"
              value={choice.value}
            />
          </RadioGroupOption>
        ))}
      </RadioGroup>
    );
  }

  return (
    <RadioGroup aria-label={label} className={LIST_GROUP_CLASS} onValueChange={pick} value={value}>
      {choices.map((choice) => (
        <RadioGroupOption className={CHOICE_ROW_CLASS} key={choice.value}>
          {choice.icon && (
            <ListRowLeading className="bg-muted size-10 justify-center rounded-xl [&_svg]:size-5">
              {choice.icon}
            </ListRowLeading>
          )}

          <ListRowContent>
            <ListRowTitle>{choice.label}</ListRowTitle>
            {choice.description && <ListRowDescription>{choice.description}</ListRowDescription>}
          </ListRowContent>

          <ChoiceRadio value={choice.value} />
        </RadioGroupOption>
      ))}
    </RadioGroup>
  );
}
