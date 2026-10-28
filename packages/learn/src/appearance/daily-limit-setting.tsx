"use client";

import { DAILY_LIMIT_CHOICES } from "@zoonk/core/profile/daily-limit";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { SelectSettingRow } from "../_components/setting-rows";
import { useFormatDuration } from "../_utils/time-format";

const NO_LIMIT = "none";

export function DailyLimitSetting({
  minutes,
  onChange,
}: {
  minutes: number | null;
  onChange: (minutes: number | null) => void;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const selectId = useId();
  const descriptionId = useId();

  const choice =
    minutes !== null && DAILY_LIMIT_CHOICES.includes(minutes) ? String(minutes) : NO_LIMIT;

  return (
    <SelectSettingRow
      description={t("Stop for the day after this much study.")}
      descriptionId={descriptionId}
      label={t("Daily time limit")}
      selectId={selectId}
    >
      <NativeSelect
        aria-describedby={descriptionId}
        id={selectId}
        onChange={(event) =>
          onChange(event.target.value === NO_LIMIT ? null : Number(event.target.value))
        }
        size="sm"
        value={choice}
      >
        <NativeSelectOption value={NO_LIMIT}>{t("No limit")}</NativeSelectOption>
        {DAILY_LIMIT_CHOICES.map((limit) => (
          <NativeSelectOption key={limit} value={String(limit)}>
            {t("{time} a day", { time: formatDuration(limit) })}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </SelectSettingRow>
  );
}
