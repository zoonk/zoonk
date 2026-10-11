"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useFormatter } from "next-intl";
import { isoDateToUtc } from "../_utils/iso-date";

/**
 * A calendar page for one day ("NOV" over a big "8"), or for a month whose day isn't known yet
 * (`monthOnly`: "2027" over "MAR"): the anchor of a screen about a date, such as an exam's.
 * Decorative: the text beside it says the day in words.
 */
export function DateTile({
  className,
  isoDate,
  monthOnly = false,
}: {
  className?: string;
  isoDate: string;
  monthOnly?: boolean;
}) {
  const format = useFormatter();
  const date = isoDateToUtc(isoDate);
  const month = format.dateTime(date, { month: "short", timeZone: "UTC" }).replace(".", "");
  const day = format.dateTime(date, { day: "numeric", timeZone: "UTC" });
  const year = format.dateTime(date, { timeZone: "UTC", year: "numeric" });

  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-card flex w-16 shrink-0 flex-col overflow-hidden rounded-2xl text-center shadow-xs ring-1 ring-black/10 dark:ring-white/15",
        className,
      )}
      data-slot="date-tile"
    >
      <span className="bg-foreground text-background py-1 text-[0.6875rem] leading-4 font-semibold tracking-wider uppercase">
        {monthOnly ? year : month}
      </span>
      {monthOnly ? (
        <span className="py-1.5 text-xl leading-9 font-bold tracking-tight uppercase">{month}</span>
      ) : (
        <span className="py-1.5 text-3xl leading-9 font-bold tracking-tight tabular-nums">
          {day}
        </span>
      )}
    </span>
  );
}
