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
import { DropdownMenuGroup, DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { ArchiveIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { useChangeSaveErrorMessage } from "../_components/save-error";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionSummary,
} from "../_components/suggestion";
import { SlotContent } from "../plan/plan-suggestion-context";
import { useResumeEffectText } from "./resume-effect";

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
  /**
   * What resuming the paused goal would do to its plan (see `getGoalResumePreview`), shown before
   * the learner resumes it; null for a goal that isn't paused.
   */
  resume: boolean;
  status: "active" | "completed" | "paused";
};

/** What went wrong changing a goal, said once in a toast: the menu has closed by then. */
function useStatusError() {
  const t = useExtracted();
  const saveError = useChangeSaveErrorMessage();

  return (outcome: GoalStatusOutcome) => {
    showErrorToast(
      outcome === "limitReached"
        ? t(
            "The free plan follows one goal at a time. Pause your other goal to resume this one, or get Plus for more.",
          )
        : saveError,
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

/**
 * Resuming from the "…" a goal whose plan it changes asks first, with what it changes (see
 * `ResumeEffect`), as Apply waits for a change's effect: the menu has no room to show it.
 */
export function ResumeGoalDialog({
  goalTitle,
  onOpenChange,
  onResume,
  open,
}: {
  goalTitle: string;
  onOpenChange: (open: boolean) => void;
  onResume: () => void;
  open: boolean;
}) {
  const t = useExtracted();
  const effectText = useResumeEffectText();

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Resume {goal}?", { goal: goalTitle })}</AlertDialogTitle>
          <AlertDialogDescription>{effectText}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onResume}>{t("Resume")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
 * A paused goal says so in the Plan's slot, first, with the way back: nothing is planned for it
 * until the learner resumes it. When resuming changes the plan (the pause left lessons behind),
 * the slot says what it changes before Resume, as a proposal waits for its effect, and the line
 * on a phone opens it with "View" instead of resuming on its own.
 */
export function GoalPausedSuggestion({
  control,
  goalTitle,
}: {
  control: GoalStatusControl;
  goalTitle: string;
}) {
  const t = useExtracted();
  const effectText = useResumeEffectText();
  const { isPending, setStatus } = useSetGoalStatus(control.onSetStatus);
  const title = t("{goal} is paused", { goal: goalTitle });
  const preview = control.resume;

  const resume = (
    <SuggestionAction disabled={isPending} onClick={() => setStatus("active")}>
      {t("Resume")}
    </SuggestionAction>
  );

  return (
    <Suggestion label={title} mark={<PauseIcon />}>
      <SuggestionLine>
        <SuggestionSummary>{title}</SuggestionSummary>
        {preview ? <SuggestionOpen /> : resume}
      </SuggestionLine>

      <SlotContent>
        <SuggestionHeader>{title}</SuggestionHeader>
        <SuggestionDescription>
          {preview ? effectText : t("Nothing is planned until you resume it.")}
        </SuggestionDescription>
        <SuggestionActions>{resume}</SuggestionActions>
      </SlotContent>
    </Suggestion>
  );
}
