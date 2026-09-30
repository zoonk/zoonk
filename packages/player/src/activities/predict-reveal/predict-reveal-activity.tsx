"use client";

import { Lightbulb } from "lucide-react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityGuessReveal } from "../_components/activity-guess-reveal";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { type ActivityRendererProps } from "../activity-renderer";

type PredictRevealProps = ActivityRendererProps<"predictReveal">;

/**
 * Commit to a guess on the scale before anything is explained, so the gap to the real value is
 * felt. Once checked, the guess is locked, the real (cited) value appears on the same scale with
 * the gap shaded, and the explanation says why.
 */
export function PredictRevealActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: PredictRevealProps) {
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
      <p className="flex items-start gap-2 text-sm leading-snug">
        <Lightbulb aria-hidden="true" className="text-viz-highlight mt-0.5 size-4 shrink-0" />
        <LessonRichText text={fields.explanation} />
      </p>
    </ActivityGuessReveal>
  );
}
