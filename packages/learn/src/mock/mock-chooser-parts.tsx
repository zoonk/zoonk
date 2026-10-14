"use client";

import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type HelpLimit } from "../_components/help-limit-notice";
import {
  LIST_GROUP_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PlusNotice } from "../_components/plus-lock";
import { type GenerationRun } from "../generation/generation-run";
import { CHOICE_ROW_CLASS } from "../onboarding/choice-list";

/**
 * The picked mock can ask only part of its questions now, and nothing more can be written for it:
 * how many of how many, in how long, and whether fair use for new ones renews the next day or
 * month (`limit`). Start then takes it as it is.
 */
type MockShortStatus = {
  examQuestions: number;
  kind: "short";
  limit: "day" | "month" | "total" | null;
  minutes: number;
  /** The option it's for: picking another one asks again. */
  optionKey: string;
  questions: number;
};

/**
 * Where the chooser stands: picking, the run writing the picked mock's questions, a mock that can
 * ask only part of its questions now, or why it couldn't start (a bank with too few questions even
 * after writing, AI help used up for now, or a request that failed).
 */
export type MockChooserStatus =
  | { kind: "choosing" }
  | { kind: "writing"; run: GenerationRun }
  | MockShortStatus
  | { kind: "failed"; reason: "failed" | "notEnoughQuestions" }
  | { kind: "refused"; limit: HelpLimit };

/** One mock (or length) to pick: its name, what it covers under it, and its size at its end. */
export type MockChoice<Value extends string> = {
  description?: string;
  label: string;
  /** The size in the mono face ("90 q · ~4h 42m"). */
  trailing?: string;
  value: Value;
};

/**
 * One mock from a short list, as flat rows with hairlines between them, like every list: the name,
 * what it covers in a quiet line and its size in the mono face at the end. The picked row is
 * highlighted a little past the column with a check, and a tap anywhere on a row picks it. On a
 * phone the size goes under the name, which then keeps the row's width instead of wrapping word by
 * word. One radio group for assistive tech; number keys pick from it, unless another list on the
 * screen owns them (`numberKeys`).
 */
export function MockChoiceRows<Value extends string>({
  choices,
  label,
  numberKeys = true,
  onChange,
  value,
}: {
  choices: readonly MockChoice<Value>[];
  label: string;
  numberKeys?: boolean;
  onChange: (value: Value) => void;
  value: Value | null;
}) {
  const pickAt = (index: number) => {
    const choice = choices[index];

    if (choice) {
      onChange(choice.value);
    }
  };

  useNumberKeys({ count: choices.length, enabled: numberKeys, onPick: pickAt });

  return (
    <RadioGroup
      aria-label={label}
      className={cn(LIST_GROUP_CLASS, "gap-0")}
      onValueChange={(next) => pickAt(choices.findIndex((choice) => choice.value === next))}
      value={value}
    >
      {choices.map((choice) => (
        <RadioGroupOption
          className={cn(
            CHOICE_ROW_CLASS,
            "font-normal max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-y-0",
          )}
          data-highlighted={choice.value === value || undefined}
          key={choice.value}
        >
          <ListRowContent className={cn(choice.trailing && "max-sm:min-h-0 max-sm:pb-0")}>
            <ListRowTitle>{choice.label}</ListRowTitle>
            {choice.description && <ListRowDescription>{choice.description}</ListRowDescription>}
          </ListRowContent>

          {choice.trailing && (
            <ListRowTrailing className="max-sm:col-start-1 max-sm:self-start max-sm:pt-px max-sm:pb-2.75">
              {choice.trailing}
            </ListRowTrailing>
          )}

          {/* The pick is the row's highlight and its check; the radio itself stays unseen. */}
          <span
            aria-hidden="true"
            className="flex size-4 shrink-0 self-center max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1"
          >
            <CheckIcon className="text-selected hidden size-4 group-has-data-checked/choice:block" />
          </span>
          <RadioGroupItem className="sr-only" value={choice.value} />
        </RadioGroupOption>
      ))}
    </RadioGroup>
  );
}

/**
 * Every mock exam comes with Plus: the options stay visible, so the learner sees what it gives,
 * with Plus's one notice under them; the screen's main action is "See Plus", so the notice has no
 * link of its own. In onboarding (`placement`), it says the quick questions set the starting point
 * without it.
 */
export function MockPlusNotice({ placement = false }: { placement?: boolean }) {
  const t = useExtracted();

  return (
    <PlusNotice cta={false}>
      {placement
        ? t("Mock exams come with Plus. Without it, the quick questions find your starting point.")
        : t("Mock exams come with Plus: whenever you want, and every week in your plan.")}
    </PlusNotice>
  );
}
