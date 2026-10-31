"use client";

import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { GoalMark } from "./goal-mark";

export type GoalKind = "exam" | "explain" | "language" | "learn";

export const MENU_ROW_CLASS = "rounded-lg pl-2 text-[0.84375rem] pointer-fine:min-h-9";

export const GOAL_ROW_CLASS = cn(MENU_ROW_CLASS, "gap-2.5 py-1.5");

export type WaitingGoal = {
  id: string;
  kind: GoalKind;
  locked: boolean;
  targetLanguage: string | null;
  title: string;
};

export function WaitingOption({
  goal,
  isStarting,
  onStart,
}: {
  goal: WaitingGoal;
  isStarting: boolean;
  onStart: (waitingGoalId: string) => void;
}) {
  const t = useExtracted("goalSwitcher");
  const routes = useLearnRoutes();

  const content = (
    <>
      <GoalMark goal={goal} />
      <span className="flex min-w-0 flex-col">
        <span>{goal.title}</span>
        <span className="text-muted-foreground font-mono text-[0.71875rem]">
          {goal.locked ? t("Starts with Plus") : t("Ready to start")}
        </span>
      </span>
    </>
  );

  if (goal.locked) {
    return (
      <DropdownMenuItem className={GOAL_ROW_CLASS} render={<LearnLink href={routes.upgrade} />}>
        {content}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      className={GOAL_ROW_CLASS}
      disabled={isStarting}
      onClick={() => onStart(goal.id)}
    >
      {content}
    </DropdownMenuItem>
  );
}
