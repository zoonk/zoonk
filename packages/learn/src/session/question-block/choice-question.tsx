"use client";

import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { type StudyQuestionAnswer } from "../session-types";

/** What the options show once graded: the right one and, when it was missed, the learner's pick. */
export type ChoiceResult = { correctIndex: number | null; pickedIndex: number | null };

function optionState({ index, result }: { index: number; result: ChoiceResult | null }) {
  if (!result) {
    return "idle";
  }

  if (index === result.correctIndex) {
    return "correct";
  }

  return index === result.pickedIndex ? "wrong" : "idle";
}

/** A quick multiple-choice question: one tap (or number key) answers it. */
export function ChoiceQuestion({
  disabled,
  onAnswer,
  options,
  result,
}: {
  disabled: boolean;
  onAnswer: (answer: StudyQuestionAnswer) => void;
  options: string[];
  result: ChoiceResult | null;
}) {
  const locked = disabled || result !== null;
  const answer = (index: number) => onAnswer({ selectedIndex: index });

  useNumberKeys({ count: options.length, enabled: !locked, onPick: answer });

  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {options.map((option, index) => {
        const state = optionState({ index, result });

        return (
          <li key={option}>
            <button
              aria-keyshortcuts={String(index + 1)}
              className={cn(
                "focus-visible:ring-ring flex min-h-14 w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left font-medium transition-colors outline-none focus-visible:ring-2 disabled:cursor-default",
                "bg-background hover:bg-muted/60",
                state === "correct" && "border-success bg-success/10",
                state === "wrong" && "border-destructive bg-destructive/10",
              )}
              disabled={locked}
              onClick={() => answer(index)}
              type="button"
            >
              {/* The key hint only shows with a keyboard, so its line box does too. */}
              <span className="hidden h-lh flex-none items-center lg:pointer-fine:flex">
                <ShortcutKbd>{String(index + 1)}</ShortcutKbd>
              </span>
              <span className="flex-1">{option}</span>
              {state !== "idle" && (
                <LineMarker>
                  {state === "correct" ? (
                    <CheckIcon aria-hidden="true" className="size-4" />
                  ) : (
                    <XIcon aria-hidden="true" className="size-4" />
                  )}
                </LineMarker>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
