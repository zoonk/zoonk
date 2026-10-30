"use client";

import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { getDailyTimes } from "../_utils/daily-times";
import { useFormatDuration } from "../_utils/time-format";
import { BigQuantity } from "./big-quantity";

type TimeChoice = {
  disabled: boolean;
  minutes: number;
  onChange: (minutes: number) => void;
  saves: boolean;
};

/**
 * A closed select changes with the keyboard on some platforms (arrows, typing a time's first
 * letters), reporting each time on the way within the key's own event. Where each time picked saves
 * (`saves`), a time reached by keys waits for Enter or for focus to leave; a pick from the open list
 * arrives later and saves at once.
 */
function useTimeChoice({ disabled, minutes, onChange, saves }: TimeChoice) {
  const [moved, setMoved] = useState<number | null>(null);
  const byKey = useRef(false);

  const pick = (next: number) => {
    setMoved(null);

    if (!disabled && next !== minutes) {
      onChange(next);
    }
  };

  return {
    onBlur: () => {
      if (moved !== null) {
        pick(moved);
      }
    },
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = Number(event.target.value);

      if (saves && byKey.current) {
        setMoved(disabled ? null : next);
      } else {
        pick(next);
      }
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLSelectElement>) => {
      // This Enter picks the time reached by keys, so the screen's own Enter action waits for the next one.
      if (event.key === "Enter" && moved !== null) {
        event.preventDefault();
        pick(moved);
        return;
      }

      byKey.current = true;

      setTimeout(() => {
        byKey.current = false;
      }, 0);
    },
    value: moved ?? minutes,
  };
}

export function TimeSelect({
  disabled = false,
  label,
  onChange,
  saves = false,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (minutes: number) => void;
  saves?: boolean;
  value: number;
}) {
  const formatDuration = useFormatDuration();
  const times = getDailyTimes(value);
  const choice = useTimeChoice({ disabled, minutes: value, onChange, saves });

  return (
    <NativeSelect aria-label={label} disabled={disabled} focusableWhenDisabled {...choice}>
      {times.map((minutes) => (
        <NativeSelectOption key={minutes} value={minutes}>
          {formatDuration(minutes)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

type DailyTimeProps = {
  disabled?: boolean;
  label: string;
  onChange: (minutes: number) => void;
  saves?: boolean;
  stale?: boolean;
  suggested?: number | null;
};

function DailyTimeReadout({
  disabled = false,
  label,
  minutes,
  onChange,
  saves = false,
  stale = false,
  suggested = null,
}: DailyTimeProps & { minutes: number }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const times = getDailyTimes(minutes, suggested);
  const choice = useTimeChoice({ disabled, minutes, onChange, saves });

  return (
    <div
      aria-busy={stale || disabled || undefined}
      className={cn(
        "hover:bg-muted has-[select:focus-visible]:ring-ring/50 relative -mx-2 w-fit rounded-lg px-2 transition-colors has-[select:focus-visible]:ring-[3px]",
        (stale || disabled) && "opacity-60",
        disabled && "hover:bg-transparent",
      )}
    >
      <span aria-hidden="true" className="flex items-center gap-2">
        <BigQuantity className="text-5xl">{formatDuration(choice.value)}</BigQuantity>
        <ChevronDownIcon className="text-muted-foreground size-5 shrink-0" />
      </span>

      <select
        aria-disabled={disabled || undefined}
        aria-label={label}
        className="absolute inset-0 size-full cursor-pointer appearance-none text-base opacity-0 aria-disabled:pointer-events-none"
        {...choice}
      >
        {times.map((time) => (
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

/** The time a day as one large readout that opens the platform's own list of times. */
export function DailyTimePicker({
  minutes,
  ...props
}: DailyTimeProps & { minutes: number | null }) {
  if (minutes === null) {
    return <Skeleton className="h-12 w-40" />;
  }

  return <DailyTimeReadout minutes={minutes} {...props} />;
}

/** For a plain form: the picked time goes with it as `name`. */
export function DailyTimeField({ defaultMinutes, name }: { defaultMinutes: number; name: string }) {
  const t = useExtracted();
  const [minutes, setMinutes] = useState(defaultMinutes);

  return (
    <>
      <DailyTimePicker label={t("Time a day")} minutes={minutes} onChange={setMinutes} />
      <input name={name} type="hidden" value={minutes} />
    </>
  );
}
