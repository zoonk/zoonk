"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { LessonRichText } from "@zoonk/learn/rich-text/lesson";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { ArrowDown, Eye } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { useCanvasQuestion } from "../_utils/canvas-question";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { type ActivityRendererProps } from "../activity-renderer";
import { BeforeAfterState } from "./before-after-state";

type BeforeAfterProps = ActivityRendererProps<"beforeAfter">;
type State = BeforeAfterProps["content"]["fields"]["before"];

function useDescribeState() {
  const format = useFormatNumber();
  const spoken = useSpokenText();

  return (state: State) =>
    [
      `${state.label}:`,
      state.facts
        .map((fact) => `${fact.label} ${format(fact.value, { unit: fact.unit })}`)
        .join(", "),
      spoken.inline(state.description),
    ].join(" ");
}

export function BeforeAfterActivity({ content, labelId, phase }: BeforeAfterProps) {
  const t = useExtracted();
  const describe = useDescribeState();
  const spoken = useSpokenText();
  const { check, fields } = content;
  const [isRevealed, setIsRevealed] = useState(false);
  const afterRef = useRef<HTMLElement>(null);
  const isChecked = phase === "checked";
  const showsAfter = isRevealed || isChecked;

  useCanvasQuestion(check.kind === "numeric" && !showsAfter);

  useEffect(() => {
    if (!isRevealed) {
      return;
    }

    const frame = requestAnimationFrame(() => afterRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isRevealed]);

  const ratios = isChecked
    ? Object.fromEntries(
        fields.before.facts.map((fact) => [
          fact.id,
          computeActivityValue(content, { output: fact.id }),
        ]),
      )
    : null;

  return (
    <ActivityCanvas labelId={labelId}>
      <BeforeAfterState isAfter={false} other={fields.after} ratios={null} state={fields.before} />

      <div className="flex items-start gap-2 px-4">
        <ArrowDown aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <p className="text-sm leading-snug font-medium">
          <LessonRichText text={fields.change} />
        </p>
      </div>

      {showsAfter ? (
        <BeforeAfterState
          isAfter
          other={fields.before}
          ratios={ratios}
          ref={afterRef}
          state={fields.after}
        />
      ) : (
        <button
          className="border-viz-accent/40 text-viz-accent hover:bg-viz-accent-soft focus-visible:ring-ring/50 flex min-h-24 items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-sm font-semibold transition-colors outline-none select-none focus-visible:ring-[3px]"
          onClick={() => setIsRevealed(true)}
          type="button"
        >
          <Eye aria-hidden="true" className="size-4" />
          {t("Show after: {label}", { label: fields.after.label })}
        </button>
      )}

      <ActivityTextAlternative>
        {describe(fields.before)} {spoken.inline(fields.change)}{" "}
        {showsAfter ? describe(fields.after) : t("The after state is hidden until you show it.")}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
