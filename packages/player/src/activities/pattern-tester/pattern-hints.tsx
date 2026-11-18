"use client";

import { Button } from "@zoonk/ui/components/button";
import { Lightbulb } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";

type Hint = { hint: string; mistake: string };

/** `reveal` shows every hint: a checked answer that still fails an example gets them all. */
export function PatternHints({
  hints,
  isChecked,
  literalNumbers,
  reveal,
}: {
  hints: readonly Hint[];
  isChecked: boolean;
  literalNumbers: boolean;
  reveal: boolean;
}) {
  const t = useExtracted();
  const [shown, setShown] = useState(0);
  const visible = reveal ? hints : hints.slice(0, shown);
  const hasMore = !reveal && shown < hints.length;

  if (visible.length === 0 && !hasMore) {
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
                  <LessonRichText literalNumbers={literalNumbers} text={item.mistake} />
                </span>
                <LessonRichText literalNumbers={literalNumbers} text={item.hint} />
              </p>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <Button
          className="self-start"
          disabled={isChecked}
          onClick={() => setShown((count) => count + 1)}
          size="lg"
          variant="outline"
        >
          <Lightbulb aria-hidden="true" />
          {shown === 0 ? t("Show a hint") : t("Show another hint")}
        </Button>
      )}
    </div>
  );
}
