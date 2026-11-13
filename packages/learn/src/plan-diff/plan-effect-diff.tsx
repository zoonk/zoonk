"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { QuietDisclosure } from "../_components/quiet-disclosure";
import { type GoalDateKind } from "../plan/goal-date-kind";
import { type ChangeOptions, type GoalDateMove, type PlanEffect } from "./change-names";
import { usePlanChangeConsequence } from "./use-change-consequence";
import { type ChangeRow, usePlanChangeRows } from "./use-change-rows";

function ChangeRows({ rows }: { rows: readonly ChangeRow[] }) {
  return (
    <dl className="text-compact flex flex-col pt-1 leading-normal [&>div+div]:border-t [&>div:last-child]:pb-0">
      {rows.map((row) => (
        <div className="flex flex-col gap-0.5 py-2" key={row.key}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <dt>{row.label}</dt>
            <dd className="font-mono tabular-nums">
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
          {row.detail && <dd className="text-muted-foreground text-pretty">{row.detail}</dd>}
        </div>
      ))}
    </dl>
  );
}

/**
 * A line in the consequence's place while a change is worked out, when it can't be, or when there
 * is none. It keeps the room of "See all changes" under it, where an `action` such as "Try again"
 * goes, so what follows holds still when the changes arrive.
 */
export function PlanEffectNote({
  action,
  busy = false,
  children,
  className,
}: {
  action?: React.ReactNode;
  busy?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-slot="plan-change-effect">
      <p
        aria-busy={busy || undefined}
        className="text-muted-foreground text-sm text-pretty"
        role="status"
      >
        {children}
      </p>
      <div className="text-compact flex h-lh leading-snug">{action}</div>
    </div>
  );
}

function namesAdded(effect: PlanEffect | null): boolean {
  return (effect?.topicsAdded?.length ?? 0) + (effect?.outcomesAdded?.length ?? 0) > 0;
}

function useShownEffect({
  effect,
  options,
  said,
  summary,
}: {
  effect: PlanEffect | null;
  options: ChangeOptions;
  said?: "lessonsAdded";
  summary: boolean;
}) {
  const found = usePlanChangeConsequence()(effect, options);
  const repeatsTitle = said === "lessonsAdded" && found?.key === "added" && !namesAdded(effect);
  const rows = usePlanChangeRows()(effect, options);
  const stated = summary ? found : null;
  const onlyRow = rows.length === 1 && rows[0]?.key === stated?.key;

  return {
    consequence: summary && !repeatsTitle ? found : null,
    hasMore: rows.length > 0 && !(onlyRow && stated?.whole),
    rows,
  };
}

/** The learner accepted other numbers: the ones under this line are today's, to answer again. */
function RepricedLine({ changes }: { changes: boolean }) {
  const t = useExtracted();

  return (
    <p className="text-sm font-medium text-pretty" role="status">
      {changes ? t("The numbers are different today.") : t("Your plan stays as it is.")}
    </p>
  );
}

/**
 * What a plan change does: the one consequence a learner would notice, and every other change
 * behind "See all changes".
 */
export function PlanEffectDiff({
  byDate = true,
  className,
  dateKind,
  effect,
  goalDate,
  repriced = false,
  said,
  summary = true,
}: {
  byDate?: boolean;
  className?: string;
  dateKind?: GoalDateKind;
  effect: PlanEffect | null;
  goalDate?: GoalDateMove;
  repriced?: boolean;
  /** What the screen's title already states, so the same count isn't said twice under it. */
  said?: "lessonsAdded";
  /** False where the screen's own sentence already says what matters most. */
  summary?: boolean;
}) {
  const t = useExtracted();

  const { consequence, hasMore, rows } = useShownEffect({
    effect,
    options: { byDate, dateKind, goalDate },
    said,
    summary,
  });

  if (!consequence && !hasMore && !repriced) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-slot="plan-change-effect">
      {repriced && <RepricedLine changes={effect !== null} />}

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
