"use client";

import { DAILY_LIMIT_CHOICES } from "@zoonk/core/profile/daily-limit";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { TimerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import {
  SettingCard,
  SettingCardDescription,
  SettingCardIcon,
  SettingCardLabel,
  SettingCardText,
} from "../_components/setting-card";

const NO_LIMIT = "none";

/** The learner's own daily study limit, for healthy use: after it, today's session ends kindly. */
export function DailyLimitSetting({
  minutes,
  onChange,
}: {
  minutes: number | null;
  onChange: (minutes: number | null) => void;
}) {
  const t = useExtracted();
  const selectId = useId();
  const descriptionId = useId();

  const choice =
    minutes !== null && DAILY_LIMIT_CHOICES.includes(minutes) ? String(minutes) : NO_LIMIT;

  return (
    <SettingCard>
      <SettingCardIcon icon={TimerIcon} />
      {/* The select needs room: under the text on phones, beside it from tablets up. */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <SettingCardText>
          <SettingCardLabel>
            <label htmlFor={selectId}>{t("Daily time limit")}</label>
          </SettingCardLabel>
          <SettingCardDescription id={descriptionId}>
            {t("Stop for the day after this much study.")}
          </SettingCardDescription>
        </SettingCardText>

        <NativeSelect
          aria-describedby={descriptionId}
          id={selectId}
          onChange={(event) =>
            onChange(event.target.value === NO_LIMIT ? null : Number(event.target.value))
          }
          value={choice}
        >
          <NativeSelectOption value={NO_LIMIT}>{t("No limit")}</NativeSelectOption>
          {DAILY_LIMIT_CHOICES.map((limit) => (
            <NativeSelectOption key={limit} value={String(limit)}>
              {t("{minutes} min a day", { minutes: String(limit) })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </SettingCard>
  );
}
