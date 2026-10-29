"use client";

import { MAX_DAILY_MINUTES } from "@zoonk/core/plans/daily-minutes";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { BigQuantity } from "../../_components/big-quantity";
import { useFormatDuration } from "../../_utils/time-format";
import { type Choice, ChoiceList } from "../choice-list";

const MINUTE_OPTIONS = ["15", "30", "45", "60", "90", "120", "180", "240"].map(Number);

const FINE_STEP = 15;
const COARSE_STEP = 30;

const FINE_UNTIL = 240;

const DAILY_TIMES = [
  ...Array.from({ length: FINE_UNTIL / FINE_STEP }, (_, index) => (index + 1) * FINE_STEP),
  ...Array.from(
    { length: Math.floor((MAX_DAILY_MINUTES - FINE_UNTIL) / COARSE_STEP) },
    (_, index) => FINE_UNTIL + (index + 1) * COARSE_STEP,
  ),
];

export const MINUTES_ID = "onboarding-minutes";

export function getTimeChoices(...times: (number | null)[]): number[] {
  const own = times.filter((time) => time !== null);
  return [...new Set([...MINUTE_OPTIONS, ...own])].toSorted((a, b) => a - b);
}

function withShownTime(value: number | null): number[] {
  return value === null || DAILY_TIMES.includes(value)
    ? DAILY_TIMES
    : [...DAILY_TIMES, value].toSorted((a, b) => a - b);
}

export function TimeSelect({
  disabled,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (minutes: number) => void;
  placeholder?: string;
  value: number | null;
}) {
  const formatDuration = useFormatDuration();
  const times = withShownTime(value);

  return (
    <NativeSelect
      aria-label={label}
      disabled={disabled}
      focusableWhenDisabled
      onChange={(event) => onChange(Number(event.target.value))}
      value={value ?? ""}
    >
      {placeholder && (
        <NativeSelectOption disabled value="">
          {placeholder}
        </NativeSelectOption>
      )}

      {times.map((minutes) => (
        <NativeSelectOption key={minutes} value={minutes}>
          {formatDuration(minutes)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/**
 * Shows the time last picked in it until a chip is picked: a phone's picker reports each time it
 * scrolls past, so it never jumps back mid-choice.
 */
export function OtherTimeSelect({
  disabled,
  label,
  minutes,
  onPick,
}: {
  disabled?: boolean;
  label: string;
  minutes: number;
  onPick: (minutes: number) => void;
}) {
  const t = useExtracted();
  const [chosen, setChosen] = useState<number | null>(null);

  return (
    <TimeSelect
      disabled={disabled}
      label={label}
      onChange={(next) => {
        setChosen(next);
        onPick(next);
      }}
      placeholder={t("Other time…")}
      value={chosen === minutes ? chosen : null}
    />
  );
}

export function DailyMinutesChoice({
  defaultMinutes,
  name,
}: {
  defaultMinutes: number;
  name: string;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const [minutes, setMinutes] = useState(defaultMinutes);

  return (
    <>
      <ChoiceList
        choices={getTimeChoices(minutes).map((option) => ({
          label: formatDuration(option),
          value: String(option),
        }))}
        label={t("Minutes a day")}
        onChange={(value) => setMinutes(Number(value))}
        value={String(minutes)}
        variant="chips"
      />
      <OtherTimeSelect label={t("Other time a day")} minutes={minutes} onPick={setMinutes} />
      <input name={name} type="hidden" value={minutes} />
    </>
  );
}

function MinutesReadout({ minutes }: { minutes: number }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (
    <p className="flex items-baseline justify-between gap-3">
      <BigQuantity className="text-5xl">{formatDuration(minutes)}</BigQuantity>
      <span className="text-muted-foreground font-mono text-sm">{t("per day")}</span>
    </p>
  );
}

export function ScheduleTimeChoices({
  choices,
  minutes,
  onChange,
}: {
  choices: Choice<string>[];
  minutes: string;
  onChange: (minutes: string) => void;
}) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-4">
      <MinutesReadout minutes={Number(minutes)} />

      <div className="flex flex-col gap-2">
        <div id={MINUTES_ID}>
          <ChoiceList
            choices={choices}
            label={t("Minutes a day")}
            onChange={onChange}
            value={minutes}
            variant="chips"
          />
        </div>

        <OtherTimeSelect
          label={t("Other time a day")}
          minutes={Number(minutes)}
          onPick={(next) => onChange(String(next))}
        />
      </div>
    </div>
  );
}
