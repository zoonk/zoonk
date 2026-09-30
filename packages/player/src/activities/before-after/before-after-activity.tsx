"use client";

import { ArrowDown, Eye } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { useFormatNumber } from "../_utils/use-format-number";
import { type ActivityRendererProps } from "../activity-renderer";
import { BeforeAfterState } from "./before-after-state";

type BeforeAfterProps = ActivityRendererProps<"beforeAfter">;
type State = BeforeAfterProps["content"]["fields"]["before"];

function useDescribeState() {
  const format = useFormatNumber();

  return (state: State) =>
    [
      `${state.label}:`,
      state.facts
        .map((fact) => `${fact.label} ${format(fact.value, { unit: fact.unit })}`)
        .join(", "),
      state.description,
    ].join(" ");
}

/**
 * Two states of the same thing with what changed between them. The learner reads the before
 * state and the change, then shows the after state: its bars start at the before length and
 * move to their own, so the size of the change is seen. Once checked, each fact says how much it
 * changed, from core's ratio (the number a numeric check grades).
 */
export function BeforeAfterActivity({ content, labelId, phase }: BeforeAfterProps) {
  const t = useExtracted();
  const describe = useDescribeState();
  const { check, fields } = content;
  const [isRevealed, setIsRevealed] = useState(false);
  const afterRef = useRef<HTMLElement>(null);
  const isChecked = phase === "checked";
  const showsAfter = isRevealed || isChecked;

  const highlightId =
    check.kind === "numeric" ? (check.output ?? fields.before.facts[0]?.id ?? null) : null;

  /* The button that revealed the after state is gone, so focus moves to what it revealed. */
  useEffect(() => {
    if (isRevealed) {
      afterRef.current?.focus();
    }
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
      <BeforeAfterState
        highlightId={highlightId}
        isAfter={false}
        other={fields.after}
        ratios={null}
        state={fields.before}
      />

      <div className="flex items-start gap-2 px-1">
        <ArrowDown aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <p className="text-sm leading-snug font-medium">
          <LessonRichText text={fields.change} />
        </p>
      </div>

      {showsAfter ? (
        <BeforeAfterState
          highlightId={highlightId}
          isAfter
          other={fields.before}
          ratios={ratios}
          ref={afterRef}
          state={fields.after}
        />
      ) : (
        <button
          className="border-viz-accent/40 text-viz-accent hover:bg-viz-accent-soft focus-visible:ring-ring/50 flex min-h-24 items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-[3px]"
          onClick={() => setIsRevealed(true)}
          type="button"
        >
          <Eye aria-hidden="true" className="size-4" />
          {t("Show after: {label}", { label: fields.after.label })}
        </button>
      )}

      <ActivityTextAlternative>
        {describe(fields.before)} {fields.change}{" "}
        {showsAfter ? describe(fields.after) : t("The after state is hidden until you show it.")}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
