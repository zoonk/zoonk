"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";
import { useExtracted } from "next-intl";
import { PlanActivities } from "./plan-activities";
import { PlanAdjust } from "./plan-adjust";
import { PlanChanges } from "./plan-changes";
import { PlanCourse, PlanFinished } from "./plan-course";
import { PlanEditPanel } from "./plan-edit-panel";
import { PlanOverview } from "./plan-overview";
import { PlanPhases } from "./plan-phases";
import { PlanShortPlan } from "./plan-short-plan";
import { PlanSteering } from "./plan-steering";
import { PlanTools } from "./plan-tools";
import { PlanToday, PlanWeek } from "./plan-week";
import { usePlanEdit } from "./use-plan-edit";

/**
 * Focus's plan: the status and estimate, what changed, then the plan at three zoom levels
 * (today, this week and until the goal), steering and the controls that reshape it.
 */
export function FocusPlan() {
  const t = useExtracted();
  const edit = usePlanEdit();

  return (
    <div className="flex flex-col gap-8">
      <PlanFinished />

      <div className="flex flex-col gap-4">
        <PlanOverview onEdit={() => edit.openAt("schedule")} />
        <PlanShortPlan />
        <PlanAdjust onNarrowScope={() => edit.openAt("words")} />
      </div>

      <PlanChanges />

      <Tabs defaultValue="goal">
        <TabsList className="w-full group-data-horizontal/tabs:h-11">
          <TabsTrigger value="today">{t("Today")}</TabsTrigger>
          <TabsTrigger value="week">{t("Week")}</TabsTrigger>
          <TabsTrigger value="goal">{t("Until the goal")}</TabsTrigger>
        </TabsList>
        <TabsContent className="pt-4" value="today">
          <PlanToday />
        </TabsContent>
        <TabsContent className="pt-4" value="week">
          <PlanWeek />
        </TabsContent>
        <TabsContent className="pt-4" value="goal">
          <PlanPhases tools={<PlanTools />} />
        </TabsContent>
      </Tabs>

      <PlanCourse />

      <PlanSteering />

      <PlanActivities />

      <PlanEditPanel focus={edit.focus} onOpenChange={edit.setOpen} open={edit.open} />
    </div>
  );
}
