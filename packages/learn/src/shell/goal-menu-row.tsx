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
  displayName: string;
};

export function WaitingOption({
  goal,
  hasAccount,
  isStarting,
  onStart,
}: {
  goal: WaitingGoal;
  hasAccount: boolean;
  isStarting: boolean;
  onStart: (waitingGoalId: string) => void;
}) {
  const t = useExtracted("goalSwitcher");
  const routes = useLearnRoutes();

  const lock = hasAccount
    ? { href: routes.upgrade, label: t("Starts with Plus") }
    : {
        href: routes.signUp,
        label: t({
          description:
            "Status under a goal in the goal switcher that a guest typed with their goals but can't start yet, read like “Starts with Plus” under an account's waiting goal: a short status, not a button or a command. Without an account a learner follows one goal at a time; a “free account” (signed up, on the free plan, not the paid plan) follows more goals at once. This counts goals followed at the same time, not new goals started per day or month. The goal comes with them when they create the account. Tapping the row opens sign-up.",
          message: "Starts with a free account",
        }),
      };

  const content = (
    <>
      <GoalMark goal={goal} />
      <span className="flex min-w-0 flex-col">
        <span>{goal.displayName}</span>
        <span className="text-muted-foreground font-mono text-[0.71875rem]">
          {goal.locked ? lock.label : t("Ready to start")}
        </span>
      </span>
    </>
  );

  if (goal.locked) {
    return (
      <DropdownMenuItem className={GOAL_ROW_CLASS} render={<LearnLink href={lock.href} />}>
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
