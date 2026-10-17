"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { useFormatDuration } from "../../_utils/time-format";
import { ChoiceList } from "../choice-list";

/** From a short habit to a full study day for a big exam: the plan takes up to 4 hours. */
export const MINUTE_OPTIONS = ["15", "30", "45", "60", "90", "120", "180", "240"].map(Number);

/**
 * The time a day as the presets onboarding asks it with, for a form outside onboarding (starting
 * from someone's shared plan): the same choices everywhere a learner picks a daily time, sent as
 * `name` with the form.
 */
export function DailyMinutesChoice({
  defaultMinutes,
  name,
}: {
  defaultMinutes: number;
  name: string;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const [minutes, setMinutes] = useState(String(defaultMinutes));

  return (
    <>
      <ChoiceList
        choices={MINUTE_OPTIONS.map((option) => ({
          label: formatDuration(option),
          value: String(option),
        }))}
        label={t("Minutes a day")}
        onChange={setMinutes}
        value={minutes}
        variant="chips"
      />
      <input name={name} type="hidden" value={minutes} />
    </>
  );
}
