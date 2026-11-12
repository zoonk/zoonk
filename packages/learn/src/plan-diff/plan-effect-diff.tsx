"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { QuietDisclosure } from "../_components/quiet-disclosure";
import { type GoalDateMove, type PlanEffect } from "./change-names";
import { usePlanChangeConsequence } from "./use-change-consequence";
import { type ChangeRow, usePlanChangeRows } from "./use-change-rows";

function ChangeRows({ rows }: { rows: readonly ChangeRow[] }) {
  return (
    <dl className="flex flex-col pt-1 text-[0.8125rem] leading-snug [&>div+div]:border-t">
      {rows.map((row) => (
        <div className="flex flex-col gap-0.5 py-2" key={row.key}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="tabular-nums">
              {row.before && (
                <>
                  <span className="text-muted-foreground">{row.before}</span>
                  <span aria-hidden="true" className="text-muted-foreground">
                    {" → "}
                  </span>
                  <span className="sr-only">{", "}</span>
                </>
              )}
              {row.after}
            </dd>
          </div>
          {row.detail && (
            <dd className="text-muted-foreground text-xs text-pretty">{row.detail}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

function namesAdded(effect: PlanEffect | null): boolean {
  return (effect?.topicsAdded?.length ?? 0) + (effect?.outcomesAdded?.length ?? 0) > 0;
}

/**
 * What a plan change does: the one consequence a learner would notice, and every other change
 * behind "See all changes".
 */
export function PlanEffectDiff({
  byDate = true,
  className,
  effect,
  goalDate,
  said,
  summary = true,
}: {
  byDate?: boolean;
  className?: string;
  effect: PlanEffect | null;
  goalDate?: GoalDateMove;
  /** What the screen's title already states, so the same count isn't said twice under it. */
  said?: "lessonsAdded";
  /** False where the screen's own sentence already says what matters most. */
  summary?: boolean;
}) {
  const t = useExtracted();
  const found = usePlanChangeConsequence()(effect, { byDate, goalDate });
  const repeatsTitle = said === "lessonsAdded" && found?.key === "added" && !namesAdded(effect);
  const consequence = summary && !repeatsTitle ? found : null;
  const rows = usePlanChangeRows()(effect, { byDate, goalDate });
  const stated = summary ? found : null;
  const onlyRow = rows.length === 1 && rows[0]?.key === stated?.key;
  const hasMore = rows.length > 0 && !(onlyRow && stated?.whole);

  if (!consequence && !hasMore) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-slot="plan-change-effect">
      {consequence && (
        <p className="text-sm text-pretty" data-slot="plan-change-consequence">
          {consequence.text}
        </p>
      )}

      {hasMore && (
        <QuietDisclosure label={t("See all changes")}>
          <ChangeRows rows={rows} />
        </QuietDisclosure>
      )}
    </div>
  );
}
