"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment } from "react";
import { StatTile, StatTileLabel, StatTileValue } from "../_components/stat-tile";
import { useFormatIsoDate } from "../_utils/iso-date";
import { PLAN_TITLE_ID, usePlanScreen } from "./plan-context";
import { PlanStatusLabel } from "./plan-status-label";
import { SharePlanButton } from "./share-plan-button";
import { usePaceNote, usePlanEstimate, useScheduleLine } from "./use-plan-estimate";

/** One size down on phones, where a third of the width fits "Ca. 100 Std." only that way. */
const TILE_VALUE_CLASS = "text-base sm:text-lg";

/**
 * The top of Focus's plan: the goal, one status line, the date or the size, and an honest
 * estimate of the time it takes at the learner's pace.
 */
export function PlanOverview({ onEdit }: { onEdit: () => void }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { goal, plan, tutor } = usePlanScreen();
  const estimate = usePlanEstimate();
  const paceNote = usePaceNote();
  const scheduleLine = useScheduleLine();
  const { targetDate } = plan.schedule;

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-muted-foreground min-w-0 text-sm">{goal.title}</p>
          {plan.status && <PlanStatusLabel className="shrink-0" status={plan.status} />}
        </div>

        <h1
          className="focus-visible:ring-ring/50 rounded-sm text-3xl font-semibold tracking-tight outline-none focus-visible:ring-[3px]"
          id={PLAN_TITLE_ID}
          tabIndex={-1}
        >
          {targetDate
            ? t("Until {date}", { date: formatDate(targetDate, "long") })
            : t("Your plan")}
        </h1>

        <p className="text-muted-foreground text-sm">
          {scheduleLine}{" "}
          <button
            className="text-foreground focus-visible:ring-ring/50 hit-area relative rounded font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]"
            onClick={onEdit}
            type="button"
          >
            {t("Edit")}
          </button>
        </p>
      </div>

      {/* The size tiles wait until the plan has an estimate, so it never reads "~0 h". */}
      <div className={cn("grid gap-2", estimate.total ? "grid-cols-3" : "grid-cols-1")}>
        {estimate.total && (
          <StatTile>
            <StatTileValue className={TILE_VALUE_CLASS}>{estimate.total}</StatTileValue>
            <StatTileLabel>{t("of study")}</StatTileLabel>
          </StatTile>
        )}
        {estimate.total && (
          <StatTile>
            <StatTileValue className={TILE_VALUE_CLASS}>
              {estimate.remaining ?? t("Nothing")}
            </StatTileValue>
            <StatTileLabel>{t("left")}</StatTileLabel>
          </StatTile>
        )}
        <StatTile>
          <StatTileValue className={TILE_VALUE_CLASS}>
            {estimate.endDate ?? t("Not set")}
          </StatTileValue>
          <StatTileLabel>{t("at this pace")}</StatTileLabel>
        </StatTile>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{paceNote}</p>
        <div className="flex items-center gap-2">
          {/* Keyed: the host's element can arrive unresolved, and siblings then need keys. */}
          <Fragment key="ask">{tutor}</Fragment>
          <SharePlanButton />
        </div>
      </div>
    </header>
  );
}
