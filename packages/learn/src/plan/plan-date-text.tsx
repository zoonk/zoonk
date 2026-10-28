"use client";

import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import { type DateTimeFormatOptions, useExtracted, useFormatter } from "next-intl";
import { use } from "react";
import { isoDateToUtc, toLocalIsoDate } from "../_utils/iso-date";
import { PlanScreenContext } from "./plan-context";
import { type PlanDateStyle, getPlanDateStyle } from "./plan-date-style";

const STYLE_OPTIONS: Record<PlanDateStyle, DateTimeFormatOptions> = {
  day: { day: "numeric", month: "short" },
  dayYear: { day: "numeric", month: "short", year: "numeric" },
  month: { month: "short" },
  monthYear: { month: "short", year: "numeric" },
};

const PLAN_DATE_CLASS = "font-mono tabular-nums whitespace-nowrap";

export function useFormatPlanDate() {
  const format = useFormatter();
  const plan = use(PlanScreenContext);
  const mountedAt = useMountTime();
  const today = plan?.today ?? toLocalIsoDate(mountedAt);

  return (isoDate: string, { month = false }: { month?: boolean } = {}): string =>
    format.dateTime(isoDateToUtc(isoDate), {
      ...STYLE_OPTIONS[getPlanDateStyle({ isoDate, month, today })],
      timeZone: "UTC",
    });
}

export function PlanDateText({
  className,
  estimate = false,
  isoDate,
  month = false,
}: {
  className?: string;
  estimate?: boolean;
  isoDate: string;
  month?: boolean;
}) {
  const t = useExtracted();
  const formatPlanDate = useFormatPlanDate();
  const date = formatPlanDate(isoDate, { month });

  if (!estimate) {
    return <span className={cn(PLAN_DATE_CLASS, className)}>{date}</span>;
  }

  return (
    <span className={cn(PLAN_DATE_CLASS, className)}>
      <span aria-hidden="true">{t("~{date}", { date })}</span>
      <span className="sr-only">{t("About {date}", { date })}</span>
    </span>
  );
}
