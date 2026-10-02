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
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { endLinkAction } from "./actions";

/** Ending a link is a guardian's choice, confirmed first because the learner has to invite again. */
export function EndLinkButton({ learnerName, linkId }: { learnerName: string; linkId: string }) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <AlertDialog>
        <AlertDialogTrigger render={<Button className="-ml-3 w-fit" size="sm" variant="ghost" />}>
          {t("End link")}
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Stop being {name}'s guardian?", { name: learnerName })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "You'll stop seeing their week, and your daily limit and Plus approval end. They can invite you again later.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  setFailed(!(await endLinkAction(linkId)));
                });
              }}
              variant="destructive"
            >
              {t("End link")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't end the link. Try again.")}
        </p>
      )}
    </div>
  );
}
