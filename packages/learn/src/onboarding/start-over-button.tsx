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
  AlertDialogTrigger,
} from "@zoonk/ui/components/alert-dialog";
import { Button } from "@zoonk/ui/components/button";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * The way out of a goal's onboarding, where a task's close sits: the X starts over, back to typing
 * a goal, after asking, since the answers so far are dropped.
 */
export function StartOverButton({
  disabled,
  onStartOver,
}: {
  disabled: boolean;
  onStartOver: () => void;
}) {
  const t = useExtracted();

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button className="rounded-full" disabled={disabled} size="icon-bar" variant="outline" />
        }
      >
        <XIcon aria-hidden="true" className="size-5" />
        <span className="sr-only">{t("Start over")}</span>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Start over?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("Your answers for this goal are cleared, and you type a goal again.")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onStartOver}>{t("Start over")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
