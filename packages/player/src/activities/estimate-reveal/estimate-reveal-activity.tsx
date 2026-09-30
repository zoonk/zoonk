"use client";

import { evaluateFormula } from "@zoonk/core/library/activities/expression/evaluate";
import { Lightbulb } from "lucide-react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityGuessReveal } from "../_components/activity-guess-reveal";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { useFormatNumber } from "../_utils/use-format-number";
import { type ActivityRendererProps } from "../activity-renderer";

type EstimateRevealProps = ActivityRendererProps<"estimateReveal">;

/**
 * Guess first, on a linear or log scale, then see the real value next to the guess with how it's
 * worked out. Code computes the real value and every working from the writer's expressions; the
 * guess is the numeric answer, graded with the check's tolerance.
 */
export function EstimateRevealActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: EstimateRevealProps) {
  const format = useFormatNumber();
  const { fields } = content;

  return (
    <ActivityGuessReveal
      actual={computeActivityValue(content)}
      guess={answer?.kind === "numeric" ? answer.value : null}
      isChecked={phase === "checked"}
      labelId={labelId}
      onGuessChange={(value) => onAnswerChange({ kind: "numeric", value })}
      scale={fields}
      unit={fields.unit}
    >
      <ul className="bg-background flex flex-col gap-1 rounded-2xl border px-4 py-3 text-sm tabular-nums">
        {fields.workings.map((working) => {
          const value = evaluateFormula(working.expression);

          return (
            <li className="flex gap-2" key={working.label}>
              <span className="font-medium">{value.ok ? format(value.value) : ""}</span>
              <span className="text-muted-foreground">{working.label}</span>
            </li>
          );
        })}
      </ul>

      <p className="text-sm leading-snug">
        <LessonRichText text={fields.comparison} />
      </p>

      <p className="text-muted-foreground flex items-start gap-2 text-sm leading-snug">
        <Lightbulb aria-hidden="true" className="text-viz-highlight mt-0.5 size-4 shrink-0" />
        <LessonRichText text={fields.takeaway} />
      </p>
    </ActivityGuessReveal>
  );
}
