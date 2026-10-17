"use client";

import { evaluateFormula } from "@zoonk/core/library/activities/expression/evaluate";
import { useFormatNumber } from "@zoonk/learn/format-number";
import { Lightbulb } from "lucide-react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityGuessReveal } from "../_components/activity-guess-reveal";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { type ActivityRendererProps } from "../activity-renderer";

type GuessRevealProps = ActivityRendererProps<"guessReveal">;

type Workings = Extract<
  GuessRevealProps["content"]["fields"]["truth"],
  { kind: "computed" }
>["workings"];

/** How a computed value is worked out, each step's number computed from its expression. */
function GuessWorkings({ workings }: { workings: Workings }) {
  const format = useFormatNumber();

  return (
    <ul className="bg-background flex flex-col gap-1 rounded-xl border px-4 py-3 text-sm tabular-nums">
      {workings.map((working) => {
        const value = evaluateFormula(working.expression);

        return (
          <li className="flex gap-2" key={working.label}>
            <span className="font-medium">{value.ok ? format(value.value) : ""}</span>
            <span className="text-muted-foreground">{working.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Guess first, on a linear or log scale, before anything is explained, so the gap to the real
 * value is felt. Once checked, the guess is locked and the real value appears on the same scale:
 * worked out by code with each step shown, or cited data. The comparison and the takeaway say why.
 */
export function GuessRevealActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: GuessRevealProps) {
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
      {fields.truth.kind === "computed" && <GuessWorkings workings={fields.truth.workings} />}

      {fields.comparison && (
        <p className="text-sm leading-snug">
          <LessonRichText text={fields.comparison} />
        </p>
      )}

      <p className="flex items-start gap-2 text-sm leading-snug">
        <Lightbulb aria-hidden="true" className="text-viz-highlight mt-0.5 size-4 shrink-0" />
        <LessonRichText text={fields.takeaway} />
      </p>
    </ActivityGuessReveal>
  );
}
