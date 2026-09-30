"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type ActivityStepContent } from "@zoonk/core/library/activities/templates";
import { Input } from "@zoonk/ui/components/input";
import {
  formatLocalizedNumber,
  fractionDigitsFor,
  parseLocalizedNumber,
} from "@zoonk/utils/localized-number";
import { useLocale } from "next-intl";
import { useId, useState } from "react";
import { type ActivityPhase } from "../activity-renderer";
import { ActivityCheckQuestion } from "./activity-check-question";

/** The input shows cents even when a readout would round them away, so typed answers match. */
const INPUT_FRACTION_DIGITS = 2;

type NumericCheck = Extract<ActivityStepContent["check"], { kind: "numeric" }>;

function answerValue(answer: ActivityAnswer | null): number | null {
  return answer?.kind === "numeric" ? answer.value : null;
}

/**
 * The number the canvas produced, in an input the learner can also type into. Moving the canvas
 * rewrites the input; typing leaves the canvas alone. Typed text is kept as written ("3,5") while
 * it still reads as the current answer, so the field never fights the learner.
 */
export function ActivityNumericCheck({
  answer,
  check,
  onAnswerChange,
  phase,
}: {
  answer: ActivityAnswer | null;
  check: NumericCheck;
  onAnswerChange: (answer: ActivityAnswer | null) => void;
  phase: ActivityPhase;
}) {
  const locale = useLocale();
  const [inputId, unitId] = [useId(), useId()];
  const value = answerValue(answer);
  const [typed, setTyped] = useState<string | null>(null);
  const [previousValue, setPreviousValue] = useState(value);

  if (value !== previousValue) {
    setPreviousValue(value);

    if (typed !== null && parseLocalizedNumber({ locale, text: typed }) !== value) {
      setTyped(null);
    }
  }

  const display =
    typed ??
    (value === null
      ? ""
      : formatLocalizedNumber({
          grouping: false,
          locale,
          maximumFractionDigits: Math.max(fractionDigitsFor(value), INPUT_FRACTION_DIGITS),
          value,
        }));

  function handleChange(text: string) {
    const parsed = parseLocalizedNumber({ locale, text });
    setTyped(text);
    onAnswerChange(parsed === null ? null : { kind: "numeric", value: parsed });
  }

  return (
    <div className="flex flex-col gap-3" data-slot="activity-numeric-check">
      <ActivityCheckQuestion htmlFor={inputId}>{check.question}</ActivityCheckQuestion>

      <div className="flex items-center gap-2">
        <Input
          aria-describedby={check.unit ? unitId : undefined}
          autoComplete="off"
          className="h-11 w-40 text-base tabular-nums md:text-base"
          id={inputId}
          inputMode="decimal"
          onChange={(event) => handleChange(event.target.value)}
          readOnly={phase === "checked"}
          value={display}
        />

        {check.unit && (
          <span className="text-muted-foreground text-base" id={unitId}>
            {check.unit}
          </span>
        )}
      </div>
    </div>
  );
}
