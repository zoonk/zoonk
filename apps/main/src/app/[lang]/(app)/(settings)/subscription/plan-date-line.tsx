"use client";

import { useFormatMomentDate } from "@zoonk/learn/dates";
import { useExtracted } from "next-intl";
import { renderPlanDate } from "./plan-date";

export type PlanDateKind = "ends" | "renews" | "until";

/** Drawn in the browser's zone, as every other date a learner reads. */
export function PlanDateLine({ kind, moment }: { kind: PlanDateKind; moment: Date }) {
  const t = useExtracted();
  const formatDate = useFormatMomentDate();
  const values = { date: formatDate(moment, "row", { year: "always" }), mono: renderPlanDate };

  const lines: Record<PlanDateKind, () => React.ReactNode> = {
    ends: () => t.rich("Plus ends on <mono>{date}</mono>.", values),
    renews: () => t.rich("Renews on <mono>{date}</mono>.", values),
    until: () => t.rich("You have Plus until <mono>{date}</mono>.", values),
  };

  return lines[kind]();
}
