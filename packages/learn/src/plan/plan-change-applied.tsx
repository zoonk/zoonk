"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { DrawerContent } from "@zoonk/ui/components/drawer";
import { type LucideIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PhaseEndMoves } from "./phase-end-moves";
import { usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { useChangeSentence } from "./use-change-sentence";
import { useAppliedEffectText } from "./use-effect-text";
import { useUndoChange } from "./use-undo-change";

/**
 * What a change did, beside its icon: its sentence, then what it changes (when the subjects start,
 * the lessons they gain, when the plan ends, as the plan on screen now says it). Announced as it
 * appears.
 */
export function PlanChangeSummary({
  change,
  icon: Icon,
}: {
  change: PlanChangeView;
  icon: LucideIcon;
}) {
  const t = useExtracted();
  const sentence = useChangeSentence();
  const effectText = useAppliedEffectText();
  const { plan } = usePlanScreen();
  // A choice that sets back what the latest change set is its Undo (see `changeGoalPlan`).
  const undone = change.status === "undone";
  const effect = undone ? null : effectText(change, plan.schedule);

  return (
    <div className="flex items-start gap-3" role="status">
      <span aria-hidden="true" className="flex h-6 shrink-0 items-center">
        <Icon className="text-muted-foreground size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-medium text-balance">
          {undone ? t("Undone. Your plan is back as it was.") : sentence(change)}
        </p>
        {effect && <p className="text-muted-foreground text-sm">{effect}</p>}
        {!undone && <PhaseEndMoves effect={change.effect} />}
      </div>
    </div>
  );
}

/**
 * What a change made in a sheet did, in the sheet that made it (see `PlanChangeSummary`) with Done,
 * and Undo while it's the plan's latest change.
 */
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
          <Button disabled={isPending} focusableWhenDisabled onClick={undo} variant="outline">
            {t("Undo")}
          </Button>
        )}
        {failed && <PlanFailedMessage />}
      </div>
    </>
  );
}
