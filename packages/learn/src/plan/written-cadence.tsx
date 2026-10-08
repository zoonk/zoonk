"use client";

import { type WrittenPractice } from "@zoonk/core/plans/written-practice-contract";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { useExtracted, useFormatter } from "next-intl";
import { usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { usePlanChange } from "./use-plan-change";

type WrittenCadence = WrittenPractice["cadence"];

const CADENCES = ["weekly", "biweekly", "finalWeeks"] as const satisfies WrittenCadence[];

/** Options share the row but never squeeze a label onto two lines; they wrap instead. */
const OPTION_CLASS =
  "border-border has-data-checked:border-foreground flex min-h-11 min-w-max flex-1 cursor-pointer items-center gap-2 rounded-2xl border px-3 text-sm";

/** What each cadence is called, and what it does in one honest line. */
export function useWrittenCadenceWords() {
  const t = useExtracted();

  const labels: Record<WrittenCadence, string> = {
    biweekly: t("Every other week"),
    finalWeeks: t("Only the final weeks"),
    weekly: t("Every week"),
  };

  const effects: Record<WrittenCadence, string> = {
    biweekly: t("The same practice in alternate weeks: less spread out, more at a time."),
    finalWeeks: t("Less spaced practice, concentrated in the final weeks before the exam."),
    weekly: t("Recommended: a little every week, which improves writing the most."),
  };

  const changes: Record<WrittenCadence, string> = {
    biweekly: t("Writing practice every other week from now on."),
    finalWeeks: t("Writing practice only in the final weeks from now on."),
    weekly: t("Writing practice every week from now on."),
  };

  return {
    changed: (cadence: WrittenCadence) => changes[cadence],
    effect: (cadence: WrittenCadence) => effects[cadence],
    label: (cadence: WrittenCadence) => labels[cadence],
  };
}

function isCadence(value: unknown): value is WrittenCadence {
  return CADENCES.some((cadence) => cadence === value);
}

/**
 * When the exam's written tests are practiced, one tap each: every week (recommended), every
 * other week, or only the final weeks when the plan has a date to count back from. The chosen
 * one says what it does, so the trade-off is clear before and after the tap.
 */
export function WrittenCadenceChoice({
  failed,
  onChange,
  pending,
  practice,
}: {
  failed: boolean;
  onChange: (cadence: WrittenCadence) => void;
  pending: boolean;
  practice: WrittenPractice;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const words = useWrittenCadenceWords();
  const parts = format.list(practice.parts, { type: "conjunction" });

  const cadences = CADENCES.filter(
    (cadence) => cadence !== "finalWeeks" || practice.finalWeeksFrom !== null,
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">
        {t("When to practice {parts}", { parts })}
      </legend>

      <RadioGroup
        className="flex flex-wrap gap-2"
        disabled={pending}
        onValueChange={(value) => {
          if (isCadence(value) && value !== practice.cadence) {
            onChange(value);
          }
        }}
        value={practice.cadence}
      >
        {cadences.map((cadence) => (
          <RadioGroupOption className={OPTION_CLASS} key={cadence}>
            <RadioGroupItem value={cadence} />
            {words.label(cadence)}
          </RadioGroupOption>
        ))}
      </RadioGroup>

      <p
        aria-busy={pending}
        aria-live="polite"
        className="text-muted-foreground text-sm aria-busy:opacity-60"
      >
        {words.effect(practice.cadence)}
      </p>

      {failed && <PlanFailedMessage />}
    </fieldset>
  );
}

/** The written tests' cadence in "Adjust your plan", for exams that have them. */
export function PlanWrittenPractice() {
  const { plan } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();
  const practice = plan.writtenPractice;

  if (!practice) {
    return null;
  }

  return (
    <WrittenCadenceChoice
      failed={failed}
      onChange={(cadence) => change([{ cadence, kind: "setWrittenCadence" }])}
      pending={isPending}
      practice={practice}
    />
  );
}
