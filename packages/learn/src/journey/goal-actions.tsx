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
import { safeAsync } from "@zoonk/utils/error";
import { ArchiveIcon, PauseIcon, PencilIcon, PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { useChangeSaveErrorMessage } from "../_components/save-error";
import {
  Suggestion,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionSummary,
} from "../_components/suggestion";
import { SlotContent } from "../plan/plan-suggestion-context";
import { RenameGoalDialog } from "./rename-goal-dialog";
import { useResumeEffectText } from "./resume-effect";
import { useGoalLimitText } from "./resume-goal-bar";

type GoalStatusChange = "active" | "archived" | "paused";

export type GoalStatusOutcome = "failed" | "limitReached" | "saved";

/**
 * The host reads the page again once a change is saved, and leaves it once the goal is archived.
 */
export type GoalStatusControl = {
  onRename?: (displayName: string) => Promise<boolean>;
  onSetStatus: (status: GoalStatusChange) => Promise<GoalStatusOutcome>;
  resume: boolean;
  status: "active" | "completed" | "paused";
};

/** Said in a toast: the menu has closed by then. */
function useStatusError() {
  const saveError = useChangeSaveErrorMessage();
  const limitText = useGoalLimitText();

  return (outcome: GoalStatusOutcome) => {
    showErrorToast(outcome === "limitReached" ? limitText : saveError);
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
      const { data: outcome } = await safeAsync(() => onSetStatus(status));

      if (outcome !== "saved") {
        showError(outcome ?? "failed");
      }
    });
  };

  return { isPending, setStatus };
}

export function useGoalMenu(control: GoalStatusControl | null) {
  const [archiving, setArchiving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [resuming, setResuming] = useState(false);
  const { isPending, setStatus } = useSetGoalStatus(control?.onSetStatus ?? null);

  const onSetStatus = (status: GoalStatusChange) => {
    if (status === "active" && control?.resume) {
      setResuming(true);
      return;
    }

    setStatus(status);
  };

  return {
    archive: () => {
      setArchiving(false);
      setStatus("archived");
    },
    archiving,
    control,
    isPending,
    onSetStatus,
    renaming,
    resume: () => {
      setResuming(false);
      setStatus("active");
    },
    resuming,
    setArchiving,
    setRenaming,
    setResuming,
  };
}

export type GoalMenu = ReturnType<typeof useGoalMenu>;

export function GoalMenuItems({ menu }: { menu: GoalMenu }) {
  const t = useExtracted();
  const { control } = menu;

  if (!control) {
    return null;
  }

  return (
    <DropdownMenuGroup>
      {control.onRename && (
        <DropdownMenuItem aria-haspopup="dialog" onClick={() => menu.setRenaming(true)}>
          <PencilIcon aria-hidden="true" />
          {t("Rename goal")}
        </DropdownMenuItem>
      )}

      {control.status === "active" && (
        <DropdownMenuItem onClick={() => menu.onSetStatus("paused")}>
          <PauseIcon aria-hidden="true" />
          {t("Pause this goal")}
        </DropdownMenuItem>
      )}

      {control.status === "paused" && (
        <DropdownMenuItem onClick={() => menu.onSetStatus("active")}>
          <PlayIcon aria-hidden="true" />
          {t("Resume this goal")}
        </DropdownMenuItem>
      )}

      <DropdownMenuItem aria-haspopup="dialog" onClick={() => menu.setArchiving(true)}>
        <ArchiveIcon aria-hidden="true" />
        {t("Archive this goal")}
      </DropdownMenuItem>
    </DropdownMenuGroup>
  );
}

export function GoalMenuDialogs({ goalTitle, menu }: { goalTitle: string; menu: GoalMenu }) {
  const { control } = menu;

  if (!control) {
    return null;
  }

  return (
    <>
      {menu.renaming && control.onRename && (
        <RenameGoalDialog
          displayName={goalTitle}
          onClose={() => menu.setRenaming(false)}
          onRename={control.onRename}
        />
      )}

      <ArchiveGoalDialog
        goalTitle={goalTitle}
        onArchive={menu.archive}
        onOpenChange={menu.setArchiving}
        open={menu.archiving}
      />

      {control.resume && (
        <ResumeGoalDialog
          goalTitle={goalTitle}
          onOpenChange={menu.setResuming}
          onResume={menu.resume}
          open={menu.resuming}
        />
      )}
    </>
  );
}

function ResumeGoalDialog({
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
          <AlertDialogTitle>{t("Resume your {goal} goal?", { goal: goalTitle })}</AlertDialogTitle>
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
          <AlertDialogTitle>{t("Archive your {goal} goal?", { goal: goalTitle })}</AlertDialogTitle>
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

/** Says what pausing means; the page's bar holds Resume (`ResumeGoalBar`). */
export function GoalPausedSuggestion({
  control,
  goalTitle,
}: {
  control: GoalStatusControl;
  goalTitle: string;
}) {
  const t = useExtracted();
  const effectText = useResumeEffectText();
  const title = t("Your {goal} goal is paused", { goal: goalTitle });
  const description = control.resume ? effectText : t("Nothing is planned until you resume it.");

  return (
    <Suggestion label={title} mark={<PauseIcon />}>
      <SuggestionLine>
        <div>
          <SuggestionSummary>{title}</SuggestionSummary>
          <SuggestionDescription>{description}</SuggestionDescription>
        </div>
      </SuggestionLine>

      <SlotContent>
        <SuggestionHeader>{title}</SuggestionHeader>
        <SuggestionDescription>{description}</SuggestionDescription>
      </SlotContent>
    </Suggestion>
  );
}
