"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
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
          {row.detail && <dd className="text-muted-foreground text-xs text-pretty">{row.detail}</dd>}
        </div>
      ))}
    </dl>
  );
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
  summary = true,
}: {
  byDate?: boolean;
  className?: string;
  effect: PlanEffect | null;
  goalDate?: GoalDateMove;
  /** False where the screen's own sentence already says what matters most. */
  summary?: boolean;
}) {
  const t = useExtracted();
  const found = usePlanChangeConsequence()(effect, { byDate, goalDate });
  const consequence = summary ? found : null;
  const rows = usePlanChangeRows()(effect, { byDate, goalDate });
  const onlyRow = rows.length === 1 && rows[0]?.key === consequence?.key;
  const hasMore = rows.length > 0 && !(onlyRow && consequence?.whole);

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
        <Collapsible>
          <CollapsibleTrigger className="group/changes text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 hit-area -mx-1 inline-flex items-center gap-1 rounded-md px-1 text-[0.8125rem] leading-snug underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]">
            {t("See all changes")}
            <ChevronDownIcon
              aria-hidden="true"
              className="size-3.5 transition-transform group-data-panel-open/changes:rotate-180 motion-reduce:transition-none"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
            <ChangeRows rows={rows} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
