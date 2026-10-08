"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { useId } from "react";

/** Playback speeds as a segmented control: 0.5×, 0.75×, 1×. */
export function SpeedPicker({
  className,
  onChange,
  speed,
  speeds,
}: {
  className?: string;
  onChange: (speed: number) => void;
  speed: number;
  speeds: readonly number[];
}) {
  const t = useExtracted();
  const format = useFormatter();
  const name = useId();

  return (
    <div
      aria-label={t("Speed")}
      className={cn(
        "border-border bg-background flex items-center gap-0.5 rounded-full border p-0.5",
        className,
      )}
      role="radiogroup"
    >
      {[...speeds]
        .toSorted((a, b) => a - b)
        .map((option) => (
          <label
            className={cn(
              "relative flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-medium tabular-nums",
              "has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
              speed === option ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
            key={option}
          >
            <input
              checked={speed === option}
              className="absolute inset-0 m-0 cursor-pointer opacity-0"
              name={name}
              onChange={() => onChange(option)}
              type="radio"
            />
            {t("{speed}×", { speed: format.number(option) })}
          </label>
        ))}
    </div>
  );
}
