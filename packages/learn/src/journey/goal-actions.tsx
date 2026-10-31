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

export type GoalStatusChange = "active" | "archived" | "paused";

export type GoalStatusOutcome = "failed" | "limitReached" | "saved";

/**
 * The host reads the page again once a change is saved, and leaves it once the goal is archived.
 */
export type GoalStatusControl = {
  onSetStatus: (status: GoalStatusChange) => Promise<GoalStatusOutcome>;
  resume: boolean;
  status: "active" | "completed" | "paused";
};

/** Said in a toast: the menu has closed by then. */
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
