"use client";

import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { useExtracted } from "next-intl";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { GoalCountryName, GoalMark } from "./goal-mark";

export type GoalKind = "exam" | "explain" | "language" | "learn";

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
    ? t("Pause a goal to start it")
    : t({
        description:
          "A short status, not a button, under a goal a guest typed and can't start yet. Creating a free account lets them start it; tapping the row opens sign-up.",
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
    return <DropdownMenuItem onClick={onMakeRoom}>{content}</DropdownMenuItem>;
  }

  if (goal.locked) {
    return (
      <DropdownMenuItem render={<LearnLink href={routes.signUp} />}>{content}</DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem disabled={isStarting} onClick={() => onStart(goal.id)}>
      {content}
    </DropdownMenuItem>
  );
}
