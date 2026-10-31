"use client";

import { type WrittenPractice } from "@zoonk/core/plans/written-practice-contract";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { useExtracted, useFormatter } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { usePlanScreen } from "./plan-context";
import { PLAN_OPTION_CLASS } from "./plan-option-styles";
import { usePlanChange } from "./use-plan-change";
import { useTappedChoice } from "./use-tapped-choice";

type WrittenCadence = WrittenPractice["cadence"];

const CADENCES = ["weekly", "biweekly", "finalWeeks"] as const satisfies WrittenCadence[];

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

export function WrittenCadenceChoice({
  failed,
  onChange,
  pending,
  practice,
}: {
  failed: boolean;
  onChange: (cadence: WrittenCadence, answered: () => void) => void;
  pending: boolean;
  practice: WrittenPractice;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const words = useWrittenCadenceWords();
  const choice = useTappedChoice(practice.cadence);
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
            onChange(value, choice.pick(value));
          }
        }}
        value={choice.shown}
      >
        {cadences.map((cadence) => (
          <RadioGroupOption className={PLAN_OPTION_CLASS} key={cadence}>
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
        {words.effect(choice.shown)}
      </p>

      {failed && <ChangeSaveError />}
    </fieldset>
  );
}

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
      onChange={(cadence, answered) => change([{ cadence, kind: "setWrittenCadence" }], answered)}
      pending={isPending}
      practice={practice}
    />
  );
}
