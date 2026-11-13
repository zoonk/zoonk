"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useId, useTransition } from "react";
import { useChangeSaveFailed } from "../_components/save-error";
import { CountryField } from "../language-variety/country-field";
import { usePlanScreen } from "./plan-context";
import { useTappedChoice } from "./use-tapped-choice";

/** Saved on the goal, not as a plan change: lessons stay the same, so there's nothing to preview. */
export function PlanLanguage() {
  const t = useExtracted();
  const selectId = useId();
  const { country } = usePlanScreen().goal;
  const picked = useTappedChoice(country?.region ?? null);
  const saveFailed = useChangeSaveFailed();
  const [isSaving, startSaving] = useTransition();

  if (!country) {
    return null;
  }

  const save = (region: string | null) => {
    const showSaved = picked.pick(region);

    startSaving(async () => {
      const { data: saved } = await safeAsync(() => country.onSave(region));

      // Updates after an `await` join the transition only when started in one again.
      startSaving(() => {
        if (!saved) {
          saveFailed();
        }

        showSaved();
      });
    });
  };

  return (
    <section className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor={selectId}>
        {t("Country")}
      </label>

      <CountryField
        choices={country.choices}
        disabled={isSaving}
        id={selectId}
        language={country.language}
        onChange={save}
        value={picked.shown}
      />
    </section>
  );
}
