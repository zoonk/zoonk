"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { DrawerContent } from "@zoonk/ui/components/drawer";
import { type LucideIcon, Undo2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { usePlanScreen } from "./plan-context";
import { useAppliedLine, usePlanChangeSentence } from "./use-change-sentence";
import { useUndoChange } from "./use-undo-change";

export function PlanChangeSummary({
  change,
  children,
  icon: Icon,
}: {
  change: PlanChangeView;
  /** What follows the note on its text edge, such as Undo. */
  children?: React.ReactNode;
  icon: LucideIcon;
}) {
  const t = useExtracted();
  const sentence = usePlanChangeSentence();
  const appliedLine = useAppliedLine();
  const { plan } = usePlanScreen();
  // A choice that sets back what the latest change set is its Undo (see `changeGoalPlan`).
  const undone = change.status === "undone";
  const byDate = plan.schedule.targetDate !== null && !plan.schedule.fullCourse;

  return (
    <div className="flex items-start gap-3" role="status">
      <span aria-hidden="true" className="flex h-6 shrink-0 items-center">
        <Icon className="text-muted-foreground size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="font-medium text-pretty">
          {undone ? t("Undone. Your plan is back as it was.") : sentence(change)}
        </p>
        {!undone && <PlanEffectDiff byDate={byDate} effect={change.effect} />}
        {!undone && (
          <p className="text-muted-foreground text-sm">{appliedLine(change.todaySession)}</p>
        )}
        {children}
      </div>
    </div>
  );
}

export function PlanChangeApplied({
  change,
  icon,
  onDone,
}: {
  change: PlanChangeView;
  icon: LucideIcon;
  onDone: () => void;
}) {
  const t = useExtracted();
  const { failed, isPending, undo } = useUndoChange({ change, onUndone: onDone });

  return (
    <>
      <DrawerContent className="flex flex-col gap-3 pt-2">
        <PlanChangeSummary change={change} icon={icon} />
      </DrawerContent>

      <div className="flex flex-col gap-2 border-t px-6 pt-4 pb-6">
        <Button onClick={onDone}>{t("Done")}</Button>
        {change.canUndo && (
          <Button
            busy={isPending}
            icon={<Undo2Icon aria-hidden="true" />}
            onClick={undo}
            variant="outline"
          >
            {t("Undo")}
          </Button>
        )}
        {failed && <ChangeSaveError />}
      </div>
    </>
  );
}
