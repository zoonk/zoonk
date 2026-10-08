"use client";

import { DAILY_LIMIT_CHOICES } from "@zoonk/core/minors/guardian/contract";
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

/**
 * The learner's own choices: with a guardian's limit, only shorter ones, since the guardian's
 * already applies.
 */
function getChoices(guardianMinutes: number | null): number[] {
  if (guardianMinutes === null) {
    return DAILY_LIMIT_CHOICES;
  }

  return DAILY_LIMIT_CHOICES.filter((choice) => choice < guardianMinutes);
}

function DailyLimitDescription({
  guardianMinutes,
  id,
  isMinor,
}: {
  guardianMinutes: number | null;
  id: string;
  isMinor: boolean;
}) {
  const t = useExtracted();

  if (guardianMinutes !== null) {
    return (
      <SettingCardDescription id={id}>
        {t("Your guardian set this limit. You can choose a shorter one.")}
      </SettingCardDescription>
    );
  }

  return (
    <SettingCardDescription id={id}>
      {isMinor
        ? t(
            "Stop for the day after this much study. A shorter limit from your guardian still applies.",
          )
        : t("Stop for the day after this much study.")}
    </SettingCardDescription>
  );
}

/**
 * The learner's own daily study limit, for healthy use: after it, today's session ends kindly.
 * When a guardian set one, the select shows that limit instead of "No limit", because it's the one
 * that applies until the learner picks a shorter one.
 */
export function DailyLimitSetting({
  guardianMinutes,
  isMinor,
  minutes,
  onChange,
}: {
  guardianMinutes: number | null;
  isMinor: boolean;
  minutes: number | null;
  onChange: (minutes: number | null) => void;
}) {
  const t = useExtracted();
  const selectId = useId();
  const descriptionId = useId();
  const choices = getChoices(guardianMinutes);
  const ownChoice = minutes !== null && choices.includes(minutes) ? String(minutes) : NO_LIMIT;

  return (
    <SettingCard>
      <SettingCardIcon icon={TimerIcon} />
      {/* The select needs room: under the text on phones, beside it from tablets up. */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <SettingCardText>
          <SettingCardLabel>
            <label htmlFor={selectId}>{t("Daily time limit")}</label>
          </SettingCardLabel>
          <DailyLimitDescription
            guardianMinutes={guardianMinutes}
            id={descriptionId}
            isMinor={isMinor}
          />
        </SettingCardText>

        <NativeSelect
          aria-describedby={descriptionId}
          id={selectId}
          onChange={(event) =>
            onChange(event.target.value === NO_LIMIT ? null : Number(event.target.value))
          }
          value={ownChoice}
        >
          <NativeSelectOption value={NO_LIMIT}>
            {guardianMinutes === null
              ? t("No limit")
              : t("{minutes} min a day", { minutes: String(guardianMinutes) })}
          </NativeSelectOption>
          {choices.map((choice) => (
            <NativeSelectOption key={choice} value={String(choice)}>
              {t("{minutes} min a day", { minutes: String(choice) })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </SettingCard>
  );
}
