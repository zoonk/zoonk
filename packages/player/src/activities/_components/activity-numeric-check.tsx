"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type ActivityStepContent } from "@zoonk/core/library/activities/templates";
import { ANSWER_TONE } from "@zoonk/learn/answer-tone";
import { useAppLocale } from "@zoonk/learn/locale";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@zoonk/ui/components/input-group";
import { cn } from "@zoonk/ui/lib/utils";
import {
  exactFractionDigitsFor,
  formatLocalizedNumber,
  parseLocalizedNumber,
} from "@zoonk/utils/localized-number";
import { getUnitPosition } from "@zoonk/utils/math-answer";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { type ActivityPhase } from "../activity-renderer";
import { ActivityCheckQuestion } from "./activity-check-question";

type NumericCheck = Extract<ActivityStepContent["check"], { kind: "numeric" }>;

function answerValue(answer: ActivityAnswer | null): number | null {
  return answer?.kind === "numeric" ? answer.value : null;
}

const MAX_DECIMAL_PLACES = 15;

function roundingPlaces(check: NumericCheck): number | null {
  const allowed =
    check.tolerance.kind === "absolute"
      ? check.tolerance.value
      : check.tolerance.value * Math.abs(check.answer);

  if (Number.isInteger(check.answer) || allowed <= 0) {
    return null;
  }

  const places = Math.max(0, Math.ceil(-Math.log10(allowed)));
  return places > 0 && places <= MAX_DECIMAL_PLACES ? places : null;
}

function numericTone(isCorrect: boolean | null) {
  if (isCorrect === null) {
    return null;
  }

  return isCorrect
    ? cn(ANSWER_TONE.right, "border-success")
    : cn(ANSWER_TONE.wrong, "border-destructive");
}

export function ActivityNumericCheck({
  answer,
  check,
  className,
  onAnswerChange,
  phase,
  isCorrect,
}: {
  answer: ActivityAnswer | null;
  className?: string;
  check: NumericCheck;
  onAnswerChange: (answer: ActivityAnswer | null) => void;
  phase: ActivityPhase;
  isCorrect: boolean | null;
}) {
  const locale = useAppLocale();
  const t = useExtracted();
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

  // Once checked, the box writes the number the way the rest of the screen does.
  const display =
    (phase === "checked" ? null : typed) ??
    (value === null
      ? ""
      : formatLocalizedNumber({
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

  const places = roundingPlaces(check);
  const checkedTone = phase === "checked" ? numericTone(isCorrect) : null;

  const unit = check.unit && (
    <span className="text-muted-foreground text-base" id={unitId}>
      {check.unit}
    </span>
  );

  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="activity-numeric-check">
      <ActivityCheckQuestion htmlFor={inputId}>{check.question}</ActivityCheckQuestion>

      {places !== null && (
        <p className="text-muted-foreground text-sm">
          {t(
            "Round to {digits, plural, =0 {# decimal places} one {# decimal place} other {# decimal places}}.",
            { digits: places },
          )}
        </p>
      )}
      <div className="flex items-center gap-3">
        <InputGroup className={cn("w-40", checkedTone)}>
          {unitPosition === "prefix" && <InputGroupAddon>{unit}</InputGroupAddon>}

          <InputGroupInput
            aria-describedby={check.unit ? unitId : undefined}
            autoComplete="off"
            className="text-base tabular-nums md:text-base"
            id={inputId}
            inputMode="decimal"
            onChange={(event) => handleChange(event.target.value)}
            readOnly={phase === "checked"}
            value={display}
          />

          {unitPosition === "suffix" && (
            <InputGroupAddon align="inline-end">{unit}</InputGroupAddon>
          )}
        </InputGroup>
        <span
          className={cn("text-muted-foreground text-xs", phase !== "checked" && "invisible")}
          aria-hidden={phase !== "checked"}
        >
          {t("Your answer")}
        </span>
      </div>
    </div>
  );
}
