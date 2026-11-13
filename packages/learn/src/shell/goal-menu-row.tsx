"use client";

import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { GoalCountryName, GoalMark } from "./goal-mark";

export type GoalKind = "exam" | "explain" | "language" | "learn";

export const MENU_ROW_CLASS = "rounded-lg pl-2 text-compact pointer-fine:min-h-9";

export const GOAL_ROW_CLASS = cn(MENU_ROW_CLASS, "gap-2.5 py-1.5");

export type WaitingGoal = {
  id: string;
  languageFlag: string | null;
  locked: boolean;
  targetLanguage: string | null;
  targetRegion: string | null;
  displayName: string;
};

export function WaitingOption({
  goal,
  isStarting,
  onMakeRoom,
  onStart,
}: {
  goal: WaitingGoal;
  isStarting: boolean;
  /** Null for a guest, whose locked row goes to sign-up. */
  onMakeRoom: (() => void) | null;
  onStart: (waitingGoalId: string) => void;
}) {
  const t = useExtracted("goalSwitcher");
  const routes = useLearnRoutes();

  const lockedLine = onMakeRoom
    ? t("Pause a goal or get Plus")
    : t({
        description:
          "Status under a goal in the goal switcher that a guest typed with their goals but can't start yet, read like “Starts with Plus” under an account's waiting goal: a short status, not a button or a command. Without an account a learner follows one goal at a time; a “free account” (signed up, on the free plan, not the paid plan) follows more goals at once. This counts goals followed at the same time, not new goals started per day or month. The goal comes with them when they create the account. Tapping the row opens sign-up.",
        message: "Starts with a free account",
      });

  const content = (
    <>
      <GoalMark goal={goal} />
      <span className="flex min-w-0 flex-col">
        <span>
          {goal.displayName}
          <GoalCountryName goal={goal} />
        </span>
        <span className="text-muted-foreground text-2xs font-mono">
          {goal.locked ? lockedLine : t("Ready to start")}
        </span>
      </span>
    </>
  );

  if (goal.locked && onMakeRoom) {
    return (
      <DropdownMenuItem className={GOAL_ROW_CLASS} onClick={onMakeRoom}>
        {content}
      </DropdownMenuItem>
    );
  }

  if (goal.locked) {
    return (
      <DropdownMenuItem className={GOAL_ROW_CLASS} render={<LearnLink href={routes.signUp} />}>
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
