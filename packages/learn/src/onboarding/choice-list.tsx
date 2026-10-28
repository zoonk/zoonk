"use client";

import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef } from "react";
import {
  LIST_GROUP_CLASS,
  LIST_ROW_INTERACTIVE_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { CHOICE_CONTROL_CLASS, CHOICE_PICKED_ROW_CLASS } from "./choice-styles";
import { useOnboardingAnnounce } from "./onboarding-announcer";

export type Choice<Value extends string> = {
  description?: string;
  label: React.ReactNode;
  value: Value;
};

const NUMBER_KEY_COUNT = 9;

function ChoiceRadio<Value extends string>({ value }: { value: Value }) {
  return (
    <span className="relative flex shrink-0 self-center">
      <RadioGroupItem
        className={cn(CHOICE_CONTROL_CLASS, "**:data-[slot=radio-group-indicator]:hidden")}
        value={value}
      />
      <CheckIcon
        aria-hidden="true"
        className="text-selected-foreground pointer-events-none absolute inset-0 m-auto hidden size-3 group-has-data-checked/choice:block"
        strokeWidth={3}
      />
    </span>
  );
}

export const CHOICE_ROW_CLASS = cn(
  LIST_ROW_INTERACTIVE_CLASS,
  CHOICE_PICKED_ROW_CLASS,
  "group/choice has-focus-visible:before:ring-ring/50 cursor-pointer has-focus-visible:before:ring-[3px]",
);

const CHIP_CLASS = cn(
  "ring-input press flex cursor-pointer items-center rounded-lg ring-1 [--press-scale:0.99] ring-inset",
  "hover:bg-muted has-data-checked:bg-selected-tint has-data-checked:ring-selected has-focus-visible:outline-ring has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-data-checked:ring-2",
);

type ChoiceListVariant = "chips" | "rows";

/**
 * `onPick` hears only a deliberate pick (a tap, a click or a number key), never the arrow keys, so
 * a one-answer question can move on with it.
 */
export function ChoiceList<Value extends string>({
  choices,
  label,
  manualActivation = false,
  numberKeys = true,
  onChange,
  onPick,
  readOnly = false,
  value,
  variant = "rows",
}: {
  choices: Choice<Value>[];
  label: string;
  manualActivation?: boolean;
  numberKeys?: boolean;
  onChange: (value: Value) => void;
  onPick?: (value: Value) => void;
  readOnly?: boolean;
  value: Value | null;
  variant?: ChoiceListVariant;
}) {
  const t = useExtracted();
  const announce = useOnboardingAnnounce();

  // The option a pointer went down on, so its click counts as a pick and a keyboard's doesn't.
  const pointerPick = useRef<Value | null>(null);

  const pickDeliberately = (choice: Choice<Value>) => {
    if (!onPick || readOnly) {
      return;
    }

    onPick(choice.value);

    if (typeof choice.label === "string") {
      announce?.(t("You picked {answer}", { answer: choice.label }));
    }
  };

  useNumberKeys({
    count: choices.length,
    enabled: numberKeys && !readOnly,
    onPick: (index) => {
      const choice = choices[index];

      if (choice) {
        onChange(choice.value);
        pickDeliberately(choice);
      }
    },
  });

  const pickByPointer = (choice: Choice<Value>) => {
    if (pointerPick.current === choice.value) {
      pointerPick.current = null;
      pickDeliberately(choice);
    }
  };

  const pick = (next: unknown) => {
    const choice = choices.find((item) => item.value === next);

    if (choice) {
      onChange(choice.value);
    }
  };

  if (variant === "chips") {
    return (
      <div className="@container">
        <RadioGroup
          aria-label={label}
          className="grid grid-cols-2 gap-2 @[19rem]:grid-cols-3 @[26rem]:grid-cols-4"
          onValueChange={pick}
          readOnly={readOnly}
          value={value}
        >
          {choices.map((choice) => (
            <RadioGroupOption
              className={cn(CHIP_CLASS, "relative min-h-11 justify-center px-1 py-1.5 text-center")}
              key={choice.value}
              onClick={(event) => {
                // Base UI consumes Space on the radio. A label click needs its own activation.
                if (manualActivation && !readOnly && !event.defaultPrevented) {
                  event.preventDefault();
                  onChange(choice.value);
                }
              }}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-[0.8125rem] font-medium tabular-nums">
                  {choice.label}
                </span>
                {choice.description && (
                  <span className="text-muted-foreground text-[0.6875rem] leading-tight">
                    {choice.description}
                  </span>
                )}
              </span>

              <RadioGroupItem
                className="pointer-events-none absolute inset-0 size-full opacity-0"
                onFocus={(event) => {
                  /** Base UI's composite still tracks focus; its radio must not select on focus. */
                  if (manualActivation) {
                    event.preventDefault();
                  }
                }}
                onKeyDown={(event) => {
                  if (manualActivation && event.key === "Enter") {
                    event.preventDefault();
                    event.preventBaseUIHandler();

                    if (!readOnly) {
                      onChange(choice.value);
                    }
                  }
                }}
                value={choice.value}
              />
            </RadioGroupOption>
          ))}
        </RadioGroup>
      </div>
    );
  }

  return (
    <RadioGroup
      aria-label={label}
      className={LIST_GROUP_CLASS}
      onKeyDown={() => {
        pointerPick.current = null;
      }}
      onValueChange={pick}
      readOnly={readOnly}
      value={value}
    >
      {choices.map((choice, index) => (
        <RadioGroupOption
          className={CHOICE_ROW_CLASS}
          data-highlighted={choice.value === value || undefined}
          key={choice.value}
          onClick={() => pickByPointer(choice)}
          onPointerDown={() => {
            pointerPick.current = choice.value;
          }}
        >
          {numberKeys && index < NUMBER_KEY_COUNT && (
            <ListRowLeading className="hidden w-5 justify-center pointer-fine:flex">
              <ShortcutKbd>{index + 1}</ShortcutKbd>
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
