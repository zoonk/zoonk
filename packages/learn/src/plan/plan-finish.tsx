"use client";

import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { usePlanScreen } from "./plan-context";

export function PlanFinish({ pending }: { pending: boolean }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { endDate } = usePlanScreen().plan.estimate;

  if (!endDate) {
    return null;
  }

  return (
    <p aria-busy={pending} aria-live="polite" className="text-muted-foreground text-sm">
      {pending
        ? t("Working out when you'd finish…")
        : t("You finish around {month}.", { month: formatDate(endDate, "month") })}
    </p>
  );
}
