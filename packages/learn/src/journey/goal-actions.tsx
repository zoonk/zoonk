"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { Button } from "@zoonk/ui/components/button";
import { DropdownMenuGroup, DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { ArchiveIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { NoticeCard } from "../_components/notice-card";

/** What a goal's page can do to it: pause it, resume it, or archive it. */
export type GoalStatusChange = "active" | "archived" | "paused";

/** What changing a goal's status came to; resuming can hit the free plan's one active goal. */
export type GoalStatusOutcome = "failed" | "limitReached" | "saved";

/**
 * The goal's status and how its page changes it, already bound to the goal by the host. The host
 * reads the page again once a change is saved (and leaves it once the goal is archived).
 */
export type GoalStatusControl = {
  onSetStatus: (status: GoalStatusChange) => Promise<GoalStatusOutcome>;
  status: "active" | "completed" | "paused";
};

/** What went wrong changing a goal, said once in a toast: the menu has closed by then. */
function useStatusError() {
  const t = useExtracted();

  return (outcome: GoalStatusOutcome) => {
    showErrorToast(
      outcome === "limitReached"
        ? t(
            "The free plan follows one goal at a time. Pause your other goal to resume this one, or get Plus for more.",
          )
        : t("We couldn't change this goal. Try again."),
    );
  };
}

/** Changes the goal's status, saying in a toast when it didn't go through. */
export function useSetGoalStatus(onSetStatus: GoalStatusControl["onSetStatus"] | null) {
  const showError = useStatusError();
  const [isPending, startTransition] = useTransition();

  const setStatus = (status: GoalStatusChange) => {
    if (!onSetStatus) {
      return;
    }

    startTransition(async () => {
      const outcome = await onSetStatus(status);

      if (outcome !== "saved") {
        showError(outcome);
      }
    });
  };

  return { isPending, setStatus };
}

/**
 * Pause or resume, and archive, at the end of the goal's "…": they act on the goal whose page
 * this is, so it's clear which one changes. Archiving asks first.
 */
export function GoalStatusItems({
  control,
  onArchive,
  onSetStatus,
}: {
  control: GoalStatusControl;
  onArchive: () => void;
  onSetStatus: (status: GoalStatusChange) => void;
}) {
  const t = useExtracted();

  return (
    <DropdownMenuGroup>
      {control.status === "active" && (
        <DropdownMenuItem onClick={() => onSetStatus("paused")}>
          <PauseIcon aria-hidden="true" />
          {t("Pause this goal")}
        </DropdownMenuItem>
      )}

      {control.status === "paused" && (
        <DropdownMenuItem onClick={() => onSetStatus("active")}>
          <PlayIcon aria-hidden="true" />
          {t("Resume this goal")}
        </DropdownMenuItem>
      )}

      <DropdownMenuItem onClick={onArchive}>
        <ArchiveIcon aria-hidden="true" />
        {t("Archive this goal")}
      </DropdownMenuItem>
    </DropdownMenuGroup>
  );
}

/** Archiving takes a goal out of the list, so it asks first. */
export function ArchiveGoalDialog({
  goalTitle,
  onArchive,
  onOpenChange,
  open,
}: {
  goalTitle: string;
  onArchive: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useExtracted();

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Archive {goal}?", { goal: goalTitle })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("It leaves your goals and its plan stops. What you learned stays in your progress.")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onArchive}>{t("Archive")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A paused goal says so at the top of its page, with the way back: nothing is planned for it until
 * the learner resumes it.
 */
export function GoalPausedNotice({ control }: { control: GoalStatusControl }) {
  const t = useExtracted();
  const { isPending, setStatus } = useSetGoalStatus(control.onSetStatus);

  if (control.status !== "paused") {
    return null;
  }

  return (
    <NoticeCard className="items-center">
      <PauseIcon aria-hidden="true" />
      <span className="flex-1">
        {t("This goal is on pause. Nothing is planned until you resume it.")}
      </span>
      <Button disabled={isPending} onClick={() => setStatus("active")} size="sm" variant="outline">
        {t("Resume")}
      </Button>
    </NoticeCard>
  );
}
