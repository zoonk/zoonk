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
import { useExtracted } from "next-intl";
import { type WritingDraftState } from "./use-writing-draft";

/**
 * Another device saved this answer after this one last did. Nothing is overwritten on either side
 * until the learner picks one, so the dialog stays until they do.
 */
export function WritingConflictDialog({ draft }: { draft: WritingDraftState }) {
  const t = useExtracted();

  return (
    <AlertDialog open={Boolean(draft.conflict)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("This answer changed on another device")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("Keep the version you're writing here, or switch to the other one.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={draft.takeOther}>
            {t({
              description:
                "A choice between two versions of one written answer: replace what's typed here with the version saved on another device.",
              message: "Use the other",
            })}
          </AlertDialogCancel>
          <AlertDialogAction onClick={draft.keepMine}>
            {t({
              description:
                "A choice between two versions of one written answer: keep what's typed on this device and save it over the other.",
              message: "Keep this one",
            })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
