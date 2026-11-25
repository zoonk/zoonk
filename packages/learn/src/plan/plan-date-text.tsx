"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";

/** Kept whole on its line, unless it's wider than the whole line. */
const PLAN_DATE_CLASS = "inline-block whitespace-nowrap tabular-nums";

/** A date on the plan: a row's day, or its month when the plan only knows the month. */
export function useFormatPlanDate() {
  const formatDate = useFormatIsoDate();

  return (
    isoDate: string,
    { month = false, weekday = false }: { month?: boolean; weekday?: boolean } = {},
  ): string => formatDate(isoDate, month ? "rowMonth" : "row", { weekday });
}

/**
 * A date standing alone as a value (an axis date, a row's trailing date) takes the data face;
 * `inWords`, inside a phrase such as "Next Dec 13", it takes the words' face, so the phrase reads in
 * one.
 */
export function PlanDateText({
  className,
  estimate = false,
  inWords = false,
  isoDate,
  month = false,
}: {
  className?: string;
  estimate?: boolean;
  inWords?: boolean;
  isoDate: string;
  month?: boolean;
}) {
  const t = useExtracted();
  const formatPlanDate = useFormatPlanDate();
  const date = formatPlanDate(isoDate, { month });
  const dateClass = cn(PLAN_DATE_CLASS, !inWords && "font-mono", className);

  if (!estimate) {
    return (
      <span className={dateClass} data-slot="plan-date">
        {date}
      </span>
    );
  }

  return (
    <span className={dateClass} data-slot="plan-date">
      <span aria-hidden="true">{t("~{date}", { date })}</span>
      <span className="sr-only">
        {t({
          description:
            'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
          message: "{dateKind, select, month {About {date}} other {About {date}}}",
          values: { date, dateKind: month ? "month" : "day" },
        })}
      </span>
    </span>
  );
}
