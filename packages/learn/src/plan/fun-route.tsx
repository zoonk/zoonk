"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { Fragment } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { FunPace } from "./fun-pace";
import { FunRouteMap } from "./fun-route-map";
import { FunWeek } from "./fun-week";
import { PlanActivities } from "./plan-activities";
import { PlanAdjust } from "./plan-adjust";
import { PlanChanges } from "./plan-changes";
import { PLAN_TITLE_ID, usePlanScreen } from "./plan-context";
import { PlanCourse, PlanFinished } from "./plan-course";
import { PlanEditPanel } from "./plan-edit-panel";
import { PlanShortPlan } from "./plan-short-plan";
import { PlanSteering } from "./plan-steering";
import { PlanTools } from "./plan-tools";
import { SharePlanButton } from "./share-plan-button";
import { usePlanEdit } from "./use-plan-edit";
import { useScheduleLine } from "./use-plan-estimate";

function RouteHeader({ onEdit }: { onEdit: () => void }) {
  const t = useExtracted();
  const { plan, tutor } = usePlanScreen();
  const scheduleLine = useScheduleLine();

  return (
    <header className="flex flex-col gap-1">
      {/* The actions move under a long title ("Navigation") instead of covering it. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1
          className="font-fun-display focus-visible:ring-ring/50 min-w-0 rounded-sm text-3xl font-bold outline-none focus-visible:ring-[3px]"
          id={PLAN_TITLE_ID}
          tabIndex={-1}
        >
          {t("Route")}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {/* Keyed: the host's element can arrive unresolved, and siblings then need keys. */}
          <Fragment key="ask">{tutor}</Fragment>
          <SharePlanButton className="fun-glass" iconOnly />
          <Button className="fun-glass" onClick={onEdit} variant="ghost">
            {t("Edit")}
          </Button>
        </div>
      </div>
      <p className="text-fun-fg2 text-sm">
        {t("{phases, plural, one {# phase} other {# phases}} · {schedule}", {
          phases: plan.phases.length,
          schedule: scheduleLine,
        })}
      </p>
    </header>
  );
}

/**
 * Fun's plan: the same plan as a route to the destination planet, with moons for phases, the
 * boss and Big Challenge marked, the pace against the plan and the week. Changes, steering and
 * editing are the same controls as Focus.
 */
export function FunRoute({ buddy }: { buddy: LearnBuddy | null }) {
  const edit = usePlanEdit();
  const { plan } = usePlanScreen();

  return (
    <div className="flex flex-col gap-6">
      <RouteHeader onEdit={() => edit.openAt("schedule")} />
      <PlanShortPlan />
      <PlanFinished />
      <PlanAdjust onNarrowScope={() => edit.openAt("words")} />
      <PlanChanges />
      <FunRouteMap buddy={buddy} tools={<PlanTools />} />
      <PlanCourse />
      <FunPace status={plan.status} />
      <FunWeek />
      <PlanSteering />

      <PlanActivities />
      <PlanEditPanel focus={edit.focus} onOpenChange={edit.setOpen} open={edit.open} />
    </div>
  );
}
