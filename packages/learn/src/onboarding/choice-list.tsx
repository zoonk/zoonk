"use client";

import { Checkbox } from "@zoonk/ui/components/checkbox";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { MAX_PICK_KEYS, shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
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
import { CHOICE_PICKED_ROW_CLASS } from "./choice-styles";
import { useOnboardingAnnounce } from "./onboarding-announcer";

export type Choice<Value extends string> = {
  /** What the choice asks for, such as a field. Shown under the list, so picking moves no row. */
  after?: React.ReactNode;
  description?: string;
  label: React.ReactNode;
  /** A short value at the row's end, such as what the choice comes to. */
  trailing?: React.ReactNode;
  value: Value;
};

export const CHOICE_ROW_CLASS = cn(
  LIST_ROW_INTERACTIVE_CLASS,
  CHOICE_PICKED_ROW_CLASS,
  "group/choice has-focus-visible:before:ring-ring/50 cursor-pointer has-focus-visible:before:ring-[3px] has-focus-visible:before:ring-inset",
);

/**
 * A row's number key, only where there is a keyboard. Rows past the ninth keep its room, so every
 * label starts on one edge.
 */
function ChoiceKey({ index }: { index: number }) {
  return (
    <ListRowLeading className="hidden w-5 justify-center pointer-fine:flex">
      {index < MAX_PICK_KEYS && <ShortcutKbd index={index} shortcut="pick" />}
    </ListRowLeading>
  );
}

function ChoiceRowText({
  children,
  description,
  index,
  numberKeys,
}: {
  children: React.ReactNode;
  description?: string;
  index: number;
  numberKeys: boolean;
}) {
  return (
    <>
      {numberKeys && <ChoiceKey index={index} />}

      <ListRowContent>
        <ListRowTitle>{children}</ListRowTitle>
        {description && <ListRowDescription>{description}</ListRowDescription>}
      </ListRowContent>
    </>
  );
}

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
  pickOnEnter = false,
  readOnly = false,
  value,
}: {
  choices: Choice<Value>[];
  label: string;
  numberKeys?: boolean;
  /** Enter picks the highlighted choice, where no form's button answers it. */
  pickOnEnter?: boolean;
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

      if (!choice) {
        return false;
      }

      // Like a click on a picked radio, the key leaves the pick as it is.
      if (choice.value !== value) {
        onChange(choice.value);
      }

      pickDeliberately(choice);
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
    <>
      <RadioGroup
        aria-label={label}
        className={cn(LIST_GROUP_CLASS, "gap-0")}
        onKeyDown={(event) => {
          pointerPick.current = null;
          const highlighted = choices.find((choice) => choice.value === value);

          if (pickOnEnter && event.key === "Enter" && highlighted) {
            event.preventDefault();
            pickDeliberately(highlighted);
          }
        }}
        onValueChange={pick}
        readOnly={readOnly}
        value={value}
      >
        {choices.map((choice, index) => (
          <RadioGroupOption
            key={choice.value}
            className={CHOICE_ROW_CLASS}
            data-highlighted={choice.value === value || undefined}
            onClick={() => pickByPointer(choice)}
            onPointerDown={() => {
              pointerPick.current = choice.value;
            }}
          >
            <ChoiceRowText description={choice.description} index={index} numberKeys={numberKeys}>
              {choice.label}
            </ChoiceRowText>

            {choice.trailing}
            <RadioGroupItem
              aria-keyshortcuts={numberKeys ? shortcutKeys("pick", index) : undefined}
              className="self-center"
              value={choice.value}
            />
          </RadioGroupOption>
        ))}
      </RadioGroup>

      {choices.find((choice) => Boolean(choice.after))?.after}
    </>
  );
}

/**
 * Number keys tick and untick its rows, as they pick a `ChoiceList`'s: the screen's one list
 * answers 1 to 9 whether it takes one answer or several. Turn them off beside another list.
 */
export function CheckList<Value extends string>({
  choices,
  label,
  max,
  numberKeys = true,
  onChange,
  readOnly = false,
  value,
}: {
  choices: Choice<Value>[];
  label: string;
  max?: number;
  numberKeys?: boolean;
  onChange: (value: Value[]) => void;
  readOnly?: boolean;
  value: readonly Value[];
}) {
  const isFull = max !== undefined && value.length >= max;
  const isOff = (choice: Choice<Value>) => readOnly || (!value.includes(choice.value) && isFull);

  const toggle = (choice: Choice<Value>) =>
    onChange(
      value.includes(choice.value)
        ? value.filter((item) => item !== choice.value)
        : [...value, choice.value],
    );

  useNumberKeys({
    count: choices.length,
    enabled: numberKeys && !readOnly,
    onPick: (index) => {
      const choice = choices[index];

      if (!choice || isOff(choice)) {
        return false;
      }

      toggle(choice);
    },
  });

  return (
    <div aria-label={label} className={LIST_GROUP_CLASS} role="group">
      {choices.map((choice, index) => {
        const isPicked = value.includes(choice.value);
        const isDisabled = isOff(choice);

        return (
          <label
            className={cn(CHOICE_ROW_CLASS, isDisabled && "cursor-not-allowed opacity-50")}
            data-highlighted={isPicked || undefined}
            key={choice.value}
          >
            <ChoiceRowText description={choice.description} index={index} numberKeys={numberKeys}>
              {choice.label}
            </ChoiceRowText>
            <Checkbox
              aria-keyshortcuts={numberKeys ? shortcutKeys("pick", index) : undefined}
              checked={isPicked}
              className="self-center"
              disabled={isDisabled}
              onCheckedChange={() => toggle(choice)}
            />
          </label>
        );
      })}
    </div>
  );
}
