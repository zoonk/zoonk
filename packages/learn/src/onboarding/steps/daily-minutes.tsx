"use client";

import { MAX_DAILY_MINUTES } from "@zoonk/core/plans/daily-minutes";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useFormatDuration } from "../../_utils/time-format";
import { ChoiceList } from "../choice-list";

/** From a short habit to a full study day for a big exam; any other time is one select away. */
const MINUTE_OPTIONS = ["15", "30", "45", "60", "90", "120", "180", "240"].map(Number);

const FINE_STEP = 15;
const COARSE_STEP = 30;

/** Up to 4 hours, a quarter of an hour matters; past it, half hours are enough to tell apart. */
const FINE_UNTIL = 240;

/** Every time a day the select offers, up to a whole day. */
const DAILY_TIMES = [
  ...Array.from({ length: FINE_UNTIL / FINE_STEP }, (_, index) => (index + 1) * FINE_STEP),
  ...Array.from(
    { length: Math.floor((MAX_DAILY_MINUTES - FINE_UNTIL) / COARSE_STEP) },
    (_, index) => FINE_UNTIL + (index + 1) * COARSE_STEP,
  ),
];

/**
 * The time chips: the presets and the learner's own times among them (a time picked in the select
 * or on a course's page, the time Find found), in order.
 */
export function getTimeChoices(...times: (number | null)[]): number[] {
  const own = times.filter((time) => time !== null);
  return [...new Set([...MINUTE_OPTIONS, ...own])].toSorted((a, b) => a - b);
}

/** The select's times, with the one it shows when that's off the steps. */
function withShownTime(value: number | null): number[] {
  return value === null || DAILY_TIMES.includes(value)
    ? DAILY_TIMES
    : [...DAILY_TIMES, value].toSorted((a, b) => a - b);
}

/**
 * Every time a day in one native select (the phone's own picker), and the time it shows when it's
 * off the steps (1 hr 25 min, found by Find). With a `placeholder`, nothing is picked in it until
 * `value` is set.
 */
export function TimeSelect({
  disabled,
  label,
  onChange,
  placeholder,
  value,
}: {
  /** Keeps its focus, but takes no pick, while a change it depends on saves. */
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
 * "Other time…" under the time chips, for any time the presets don't have: the time picked joins
 * the chips, picked (see `getTimeChoices`), so the chips stay the one place that shows the pick.
 * The select shows the time last picked in it while that's still the time picked, and its
 * placeholder once a chip is picked: a phone's picker can report each time it scrolls past, so the
 * select never jumps back while the learner is still choosing.
 */
export function OtherTimeSelect({
  disabled,
  label,
  minutes,
  onPick,
}: {
  disabled?: boolean;
  /** What screen readers call it ("Other time a day"); its placeholder says "Other time…". */
  label: string;
  /** The time picked, from the chips or this select. */
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

/**
 * The time a day as onboarding asks it, for a form outside onboarding (starting from someone's
 * shared plan): the same presets and "Other time…" everywhere a learner picks a daily time, sent
 * as `name` with the form.
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
