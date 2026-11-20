"use client";

import { type WrittenPractice } from "@zoonk/core/plans/written-practice-contract";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { useExtracted, useFormatter } from "next-intl";
import { useId } from "react";
import { usePlanScreen } from "./plan-context";
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

  const changes: Record<WrittenCadence, string> = {
    biweekly: t("Writing practice every other week from now on."),
    finalWeeks: t("Writing practice only in the final weeks from now on."),
    weekly: t("Writing practice every week from now on."),
  };

  return {
    changed: (cadence: WrittenCadence) => changes[cadence],
    label: (cadence: WrittenCadence) => labels[cadence],
  };
}

export function WrittenCadenceChoice({
  onChange,
  pending,
  practice,
}: {
  onChange: (cadence: WrittenCadence, answered: () => void) => void;
  pending: boolean;
  practice: WrittenPractice;
}) {
  const t = useExtracted();
  const labelId = useId();
  const format = useFormatter();
  const words = useWrittenCadenceWords();
  const choice = useTappedChoice(practice.cadence);
  const parts = format.list(practice.parts, { type: "conjunction" });

  const cadences = CADENCES.filter(
    (cadence) => cadence !== "finalWeeks" || practice.finalWeeksFrom !== null,
  );

  const title = t("When to practice {parts}", { parts });

  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <h3 className="text-sm font-medium" id={labelId}>
        {title}
      </h3>

      <NativeSelect
        aria-labelledby={labelId}
        disabled={pending}
        focusableWhenDisabled
        onChange={(event) => {
          const cadence = cadences.find((option) => option === event.target.value);

          if (cadence && cadence !== practice.cadence) {
            onChange(cadence, choice.pick(cadence));
          }
        }}
        value={choice.shown}
      >
        {cadences.map((cadence) => (
          <NativeSelectOption key={cadence} value={cadence}>
            {cadence === "weekly" ? t("Every week (recommended)") : words.label(cadence)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </section>
  );
}

export function PlanWrittenPractice() {
  const { plan } = usePlanScreen();
  const { change, isPending } = usePlanChange();
  const practice = plan.writtenPractice;

  if (!practice) {
    return null;
  }

  return (
    <WrittenCadenceChoice
      onChange={(cadence, answered) => change([{ cadence, kind: "setWrittenCadence" }], answered)}
      pending={isPending}
      practice={practice}
    />
  );
}
