"use client";

import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { useFormatTimeOfDay } from "../_utils/time-format";

const MINUTES_PER_DAY = 1440;
const MINUTES_PER_HOUR = 60;

/** Reminders go out every 15 minutes, so the picker offers those times, plus a saved one between them. */
const STEP_MINUTES = 15;

function toTime(minutes: number): string {
  const hours = String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, "0");
  return `${hours}:${String(minutes % MINUTES_PER_HOUR).padStart(2, "0")}`;
}

function getReminderTimes(current: string): string[] {
  const steps = Array.from({ length: MINUTES_PER_DAY / STEP_MINUTES }, (_, index) =>
    toTime(index * STEP_MINUTES),
  );

  return steps.includes(current) ? steps : [...steps, current].toSorted();
}

export function ReminderTimeSelect({
  onChange,
  time,
  ...props
}: Omit<React.ComponentProps<typeof NativeSelect>, "onChange" | "size" | "value"> & {
  onChange: (time: string) => void;
  time: string;
}) {
  const formatTime = useFormatTimeOfDay();

  return (
    <NativeSelect
      onChange={(event) => onChange(event.target.value)}
      size="sm"
      value={time}
      {...props}
    >
      {getReminderTimes(time).map((option) => (
        <NativeSelectOption key={option} value={option}>
          {formatTime(option)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
