"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { CountryField } from "../language-variety/country-field";
import { usePlanScreen } from "./plan-context";
import { useTappedChoice } from "./use-tapped-choice";

/** Saved on the goal, not as a plan change: lessons stay the same, so there's nothing to preview. */
export function PlanLanguage() {
  const t = useExtracted();
  const selectId = useId();
  const { country } = usePlanScreen().goal;
  const picked = useTappedChoice(country?.region ?? null);
  const [failed, setFailed] = useState(false);
  const [isSaving, startSaving] = useTransition();

  if (!country) {
    return null;
  }

  const save = (region: string | null) => {
    setFailed(false);
    const showSaved = picked.pick(region);

    startSaving(async () => {
      const { data: saved } = await safeAsync(() => country.onSave(region));

      // Updates after an `await` join the transition only when started in one again.
      startSaving(() => {
        setFailed(!saved);
        showSaved();
      });
    });
  };

  return (
    <section className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor={selectId}>
        {t("Language")}
      </label>

      <CountryField
        choices={country.choices}
        disabled={isSaving}
        id={selectId}
        language={country.language}
        onChange={save}
        value={picked.shown}
      />

      {failed && <ChangeSaveError />}
    </section>
  );
}
