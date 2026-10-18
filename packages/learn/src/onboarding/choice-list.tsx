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
  /** Text, or a question's option with its emphasis (`ItemLine`). */
  label: React.ReactNode;
  value: Value;
};

/** Number keys reach the first nine options. */
const NUMBER_KEY_COUNT = 9;

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
        className="text-selected-foreground pointer-events-none absolute inset-0 m-auto hidden size-3 group-has-data-checked/choice:block"
        strokeWidth={3}
      />
    </span>
  );
}

/**
 * A choice as a flat row of one list: the whole row picks it, the picked one (`data-highlighted`)
 * on the learner's blue tint, the keyboard ring inside it.
 */
export const CHOICE_ROW_CLASS = cn(
  LIST_ROW_INTERACTIVE_CLASS,
  CHOICE_PICKED_ROW_CLASS,
  "group/choice has-focus-visible:before:ring-ring/50 cursor-pointer has-focus-visible:before:ring-[3px]",
);

/**
 * A preset (an amount of time): the strong line, and the learner's blue ring and tint once picked;
 * the keyboard's focus is an outline, so a picked preset still shows it.
 */
const CHIP_CLASS = cn(
  "ring-input flex cursor-pointer items-center rounded-lg ring-1 transition-colors ring-inset motion-reduce:transition-none",
  "hover:bg-muted has-data-checked:bg-selected-tint has-data-checked:ring-selected has-focus-visible:outline-ring has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-data-checked:ring-2",
);

/**
 * How the options sit: `rows` for answers with their own short explanation, `chips` for a short
 * list of plain values (amounts of time), several to a row.
 */
type ChoiceListVariant = "chips" | "rows";

/**
 * One answer from a short list: flat rows, each with its own short explanation and a check at its
 * end once picked, or compact presets for plain values. Number keys pick an option, unless another
 * list on the screen owns them; where there's a keyboard, each row shows its key. `onPick` hears a
 * deliberate pick (a tap, a click or a number key), so a one-answer question can move on with it,
 * and screen readers hear which answer it moved on with; the arrow keys only move the selection,
 * and Enter continues. `readOnly` keeps the pick as it is while the answer saves.
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
  /** Presets that save at once: arrows move focus; Enter, Space or a click applies. */
  manualActivation?: boolean;
  /** Off for a second list on the same screen: number keys pick from the first. */
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

  // Number keys pick an option, so the keyboard answers as fast as a tap.
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

  // Four to a row where each chip has room for its longest time on one line ("1 h 30 min"), three
  // on a phone, two in a narrow column: the columns follow the room the list has, not the screen.
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

              {/* A chip shows it's picked by its fill; its radio, invisible, still takes focus. */}
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
            // Only where there's a keyboard, so on touch the titles start at the row's edge.
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
