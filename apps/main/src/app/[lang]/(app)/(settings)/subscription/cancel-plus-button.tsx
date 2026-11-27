"use client";

import { useRouter } from "@/i18n/navigation";
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
import { showErrorToast } from "@zoonk/ui/components/toast";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type CancelPlusResult, cancelPlusAction } from "./cancel-plus-action";
import { renderPlanDate } from "./plan-date";

/** `paidUntil` is the formatted last day Plus is paid for; without it the dialog says it in words. */
export function CancelPlusButton({
  endsNow = false,
  paidUntil,
}: {
  endsNow?: boolean;
  paidUntil?: string;
}) {
  const t = useExtracted();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const cancel = () => {
    startTransition(async () => {
      const outcome = await cancelPlusAction().catch((): CancelPlusResult => "failed");

      if (outcome === "failed") {
        showErrorToast(
          t("We couldn't cancel Plus. Try again or email {email}.", {
            email: t("hello@zoonk.com"),
          }),
        );

        return;
      }

      setOpen(false);

      if (outcome === "unavailable") {
        router.refresh();
      }
    });
  };

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger render={<Button size="lg" variant="outline" />}>
        {t("Cancel Plus")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Cancel Plus?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {endsNow && t("Plus ends right away, and you won't be charged again.")}
            {!endsNow &&
              (paidUntil
                ? t.rich("You have Plus until <mono>{date}</mono>.", {
                    date: paidUntil,
                    mono: renderPlanDate,
                  })
                : t("You keep Plus until the end of the period you already paid for."))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("Keep Plus")}</AlertDialogCancel>
          <AlertDialogAction busy={pending} onClick={cancel}>
            {t("Cancel Plus")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
