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

/**
 * `onPick` hears only a deliberate pick (a tap, a click or a number key), never the arrow keys, so
 * a one-answer question can move on with it.
 */
export function ChoiceList<Value extends string>({
  choices,
  label,
  numberKeys = true,
  onChange,
  onPick,
  readOnly = false,
  value,
}: {
  choices: Choice<Value>[];
  label: string;
  numberKeys?: boolean;
  onChange: (value: Value) => void;
  onPick?: (value: Value) => void;
  readOnly?: boolean;
  value: Value | null;
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
