"use client";

import { Button } from "@zoonk/ui/components/button";
import { Lightbulb } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";

type Hint = { hint: string; mistake: string };

/**
 * Hints for likely mistakes, one at a time on request: the learner decides when they need one,
 * and each names the mistake it's for so they can tell whether it applies.
 */
export function PatternHints({ hints, isChecked }: { hints: readonly Hint[]; isChecked: boolean }) {
  const t = useExtracted();
  const [shown, setShown] = useState(0);
  const visible = isChecked ? hints : hints.slice(0, shown);

  if (hints.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2" data-slot="pattern-hints">
      {visible.length > 0 && (
        <ul aria-live="polite" className="flex flex-col gap-2">
          {visible.map((item) => (
            <li className="flex gap-2.5 text-sm leading-snug" key={item.mistake}>
              <Lightbulb aria-hidden="true" className="text-viz-highlight mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-semibold after:content-[':_']">
                  <LessonRichText text={item.mistake} />
                </span>
                <LessonRichText text={item.hint} />
              </p>
            </li>
          ))}
        </ul>
      )}

      {!isChecked && shown < hints.length && (
        <Button
          className="self-start"
          onClick={() => setShown((count) => count + 1)}
          variant="outline"
        >
          <Lightbulb aria-hidden="true" />
          {shown === 0 ? t("Show a hint") : t("Show another hint")}
        </Button>
      )}
    </div>
  );
}
