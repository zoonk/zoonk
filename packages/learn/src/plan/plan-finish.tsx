"use client";

import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { usePlanScreen } from "./plan-context";

export function PlanFinish({ pending }: { pending: boolean }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { plan, today } = usePlanScreen();
  const { endDate } = plan.estimate;

  // The end is the saved schedule's last day, laid out again only by a change: once it has
  // passed, it no longer says when the learner finishes.
  if (!endDate || endDate < today || plan.end) {
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
