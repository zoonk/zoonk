"use client";

import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { useEnterKey, useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { EnterButton } from "../../_components/enter-button";
import { ItemLine } from "../../questions/item-text";
import {
  type OptionSelect,
  PickRule,
  isCompletePick,
  isMultiPick,
  togglePick,
} from "../../questions/pick-rule";
import { type StudyQuestionAnswer } from "../session-types";

/** What the options show once graded: the right ones, and the ones the learner picked. */
export type ChoiceResult = { correct: readonly number[]; picked: readonly number[] };

function optionState({ index, result }: { index: number; result: ChoiceResult | null }) {
  if (!result) {
    return "idle";
  }

  if (result.correct.includes(index)) {
    return "correct";
  }

  return result.picked.includes(index) ? "wrong" : "idle";
}

/**
 * A multiple-choice question. One tap (or number key) answers a question with one right option;
 * one that asks for several (`select`: a number, or "all") toggles options, then Check (or Enter)
 * sends them, once as many as it asks are picked.
 */
export function ChoiceQuestion({
  disabled,
  onAnswer,
  options,
  result,
  select,
}: {
  disabled: boolean;
  onAnswer: (answer: StudyQuestionAnswer) => void;
  options: string[];
  result: ChoiceResult | null;
  select: OptionSelect | null;
}) {
  const t = useExtracted();
  const [picks, setPicks] = useState<number[]>([]);
  const locked = disabled || result !== null;
  const multi = isMultiPick(select);
  const ready = multi && isCompletePick({ picks, select });
  const check = () => onAnswer({ selectedIndexes: picks });

  const pick = (index: number) => {
    if (!multi) {
      onAnswer({ selectedIndex: index });
      return;
    }

    setPicks(togglePick(picks, index));
  };

  useNumberKeys({ count: options.length, enabled: !locked, onPick: pick });
  useEnterKey(check, { enabled: !locked && ready });

  return (
    <div className="flex flex-col gap-3">
      {multi && <PickRule select={select} />}

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {options.map((option, index) => {
          const state = optionState({ index, result });

          return (
            <li key={option}>
              <button
                aria-keyshortcuts={String(index + 1)}
                aria-pressed={multi ? picks.includes(index) : undefined}
                className={cn(
                  "focus-visible:ring-ring flex min-h-14 w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left font-medium transition-colors outline-none focus-visible:ring-2 disabled:cursor-default",
                  "bg-background hover:bg-muted/60",
                  "aria-pressed:border-foreground aria-pressed:bg-muted",
                  state === "correct" && "border-success bg-success/10 aria-pressed:border-success",
                  state === "wrong" &&
                    "border-destructive bg-destructive/10 aria-pressed:border-destructive",
                )}
                disabled={locked}
                onClick={() => pick(index)}
                type="button"
              >
                {/* The key hint only shows with a keyboard, so its line box does too. */}
                <span className="hidden h-lh flex-none items-center lg:pointer-fine:flex">
                  <ShortcutKbd>{String(index + 1)}</ShortcutKbd>
                </span>
                <span className="flex-1">
                  <ItemLine text={option} />
                </span>
                {state !== "idle" && (
                  <LineMarker>
                    {state === "correct" ? (
                      <CheckIcon aria-label={t("Right answer")} className="size-4" />
                    ) : (
                      <XIcon aria-label={t("Your answer")} className="size-4" />
                    )}
                  </LineMarker>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {multi && result === null && (
        <EnterButton disabled={disabled || !ready} onClick={check} type="button">
          {t("Check")}
        </EnterButton>
      )}
    </div>
  );
}
