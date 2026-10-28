"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type ActivityStepContent } from "@zoonk/core/library/activities/templates";
import { Input } from "@zoonk/ui/components/input";
import {
  exactFractionDigitsFor,
  formatLocalizedNumber,
  parseLocalizedNumber,
} from "@zoonk/utils/localized-number";
import { getUnitPosition } from "@zoonk/utils/math-answer";
import { useLocale } from "next-intl";
import { useId, useState } from "react";
import { type ActivityPhase } from "../activity-renderer";
import { ActivityCheckQuestion } from "./activity-check-question";

type NumericCheck = Extract<ActivityStepContent["check"], { kind: "numeric" }>;

function answerValue(answer: ActivityAnswer | null): number | null {
  return answer?.kind === "numeric" ? answer.value : null;
}

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
  const unitPosition = check.unit ? getUnitPosition({ language: locale, unit: check.unit }) : null;
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
          maximumFractionDigits: exactFractionDigitsFor({
            expected: check.answer,
            tolerance: check.tolerance,
            value,
          }),
          value,
        }));

  function handleChange(text: string) {
    const parsed = parseLocalizedNumber({ locale, text });
    setTyped(text);
    onAnswerChange(parsed === null ? null : { kind: "numeric", value: parsed });
  }

  const unit = check.unit && (
    <span className="text-muted-foreground text-base" id={unitId}>
      {check.unit}
    </span>
  );

  return (
    <div className="flex flex-col gap-3" data-slot="activity-numeric-check">
      <ActivityCheckQuestion htmlFor={inputId}>{check.question}</ActivityCheckQuestion>

      <div className="flex items-center gap-2">
        {unitPosition === "prefix" && unit}

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

        {unitPosition === "suffix" && unit}
      </div>
    </div>
  );
}
