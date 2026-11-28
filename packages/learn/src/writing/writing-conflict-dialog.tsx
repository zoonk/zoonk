"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { Button } from "@zoonk/ui/components/button";
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
          <Button onClick={draft.takeOther} size="lg" variant="outline">
            {t({
              description:
                "A choice between two versions of one written answer: replace what's typed here with the version saved on another device.",
              message: "Use the other",
            })}
          </Button>
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
