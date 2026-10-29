"use client";

import { MAX_DAILY_MINUTES } from "@zoonk/core/plans/daily-minutes";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { BigQuantity } from "../../_components/big-quantity";
import { useFormatDuration } from "../../_utils/time-format";
import { ChoiceList } from "../choice-list";

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

export function getTimeChoices(...times: (number | null)[]): number[] {
  const own = times.filter((time) => time !== null);
  return [...new Set([...MINUTE_OPTIONS, ...own])].toSorted((a, b) => a - b);
}

function withShownTime(...values: (number | null)[]): number[] {
  const own = values.filter((value) => value !== null);
  return [...new Set([...DAILY_TIMES, ...own])].toSorted((a, b) => a - b);
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

export function DailyTimePicker({
  label,
  minutes,
  onChange,
  stale = false,
  suggested,
}: {
  label: string;
  minutes: number | null;
  onChange: (minutes: number) => void;
  stale?: boolean;
  suggested: number | null;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  if (minutes === null) {
    return <Skeleton className="h-12 w-40" />;
  }

  return (
    <div
      aria-busy={stale || undefined}
      className={cn(
        "hover:bg-muted has-[select:focus-visible]:ring-ring/50 relative -mx-2 w-fit rounded-lg px-2 transition-colors has-[select:focus-visible]:ring-[3px]",
        stale && "opacity-60",
      )}
    >
      <span aria-hidden="true" className="flex items-center gap-2">
        <BigQuantity className="text-5xl">{formatDuration(minutes)}</BigQuantity>
        <ChevronDownIcon className="text-muted-foreground size-5 shrink-0" />
      </span>

      <select
        aria-label={label}
        className="absolute inset-0 size-full cursor-pointer appearance-none text-base opacity-0"
        onChange={(event) => onChange(Number(event.target.value))}
        value={minutes}
      >
        {withShownTime(minutes, suggested).map((time) => (
          <option key={time} value={time}>
            {time === suggested
              ? t("{time} (suggested)", { time: formatDuration(time) })
              : formatDuration(time)}
          </option>
        ))}
      </select>
    </div>
  );
}
