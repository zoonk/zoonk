"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type PlanStatus } from "./plan-status-label";

/** A week ahead or behind puts the learner's marker at the edge of the track. */
const DAYS_TO_EDGE = 7;
const MAX_OFFSET_PERCENT = 40;
const CENTER_PERCENT = 50;

function getLeadDays(status: PlanStatus | null): number {
  if (status?.kind === "ahead") {
    return status.days;
  }

  return status?.kind === "behind" ? -status.days : 0;
}

function usePaceText(status: PlanStatus | null): string {
  const t = useExtracted();
  const kind = status?.kind ?? "onTrack";

  switch (kind) {
    case "ahead":
      return t("{days, plural, one {# day ahead of plan} other {# days ahead of plan}}", {
        days: getLeadDays(status),
      });
    case "behind":
      return t("{days, plural, one {# day behind plan} other {# days behind plan}}", {
        days: -getLeadDays(status),
      });
    case "needsAdjusting":
      return t("The route needs adjusting");
    case "onTrack":
      return t("Right on plan");
    default:
      return t("Right on plan");
  }
}

/**
 * "You vs. plan": the dashed plan marker in the middle and the learner ahead of it or behind,
 * so the pace reads at a glance. The same status line Focus shows in words.
 */
export function FunPace({ status }: { status: PlanStatus | null }) {
  const t = useExtracted();
  const text = usePaceText(status);
  const lead = Math.max(-DAYS_TO_EDGE, Math.min(DAYS_TO_EDGE, getLeadDays(status)));
  const learnerPercent = CENTER_PERCENT + (lead / DAYS_TO_EDGE) * MAX_OFFSET_PERCENT;

  return (
    <section
      aria-label={t("You vs. plan")}
      className="fun-glass flex flex-col gap-4 rounded-3xl p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-fun-fg2 text-sm">{t("You vs. plan")}</h2>
        <p className="text-fun-accent-lime text-sm font-semibold" data-slot="fun-pace-text">
          {text}
        </p>
      </div>

      <div aria-hidden="true" className="relative h-8">
        <span className="border-fun-dash absolute inset-x-0 top-1/2 border-t-2 border-dashed" />
        <span
          className="bg-fun-accent-lime absolute top-1/2 left-0 h-0.5 -translate-y-1/2 rounded-full"
          style={{ width: `${learnerPercent}%` }}
        />
        <span className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <span className="border-fun-fg2 bg-background size-4 rounded-full border-2 border-dashed" />
        </span>
        <span
          className={cn(
            "bg-fun-accent-lime absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full",
            "shadow-[0_0_14px_var(--fun-accent-lime)]",
          )}
          style={{ left: `${learnerPercent}%` }}
        />
        <span className="text-fun-fg3 absolute top-full left-1/2 -translate-x-1/2 text-xs font-semibold tracking-widest uppercase">
          {t("Plan")}
        </span>
      </div>
    </section>
  );
}
