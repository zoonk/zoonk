"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlanActivities } from "./plan-activities";
import { PlanEditRequest } from "./plan-edit-request";
import { PlanSchedule } from "./plan-schedule";
import { PlanSteering } from "./plan-steering";
import { PlanTools } from "./plan-tools";
import { PlanWrittenPractice } from "./written-cadence";

/**
 * "Adjust your plan": everything that reshapes it in one sheet. Time a day and study days, what a
 * language plan practices, when an exam's written tests are practiced, how the lessons feel, the
 * tools it needs, and anything else in the learner's own words. Each change re-plans from today and shows behind the sheet at once.
 */
export function PlanEditor({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useExtracted();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <DrawerHeader className="flex-row items-center justify-between gap-3">
          <DrawerTitle className="text-xl font-semibold">{t("Adjust your plan")}</DrawerTitle>
          {/* Every change is saved as it's made, so closing is all that's left to do. */}
          <DrawerClose render={<Button className="-mr-2" size="icon" variant="ghost" />}>
            <XIcon aria-hidden="true" />
            <span className="sr-only">{t("Close")}</span>
          </DrawerClose>
        </DrawerHeader>

        <DrawerContent className="flex flex-col gap-7 pt-2">
          <PlanSchedule />
          <PlanActivities />
          <PlanWrittenPractice />
          <PlanSteering />
          <PlanTools />
          <PlanEditRequest />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
