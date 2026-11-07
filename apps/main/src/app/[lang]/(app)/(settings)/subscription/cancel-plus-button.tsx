"use client";

import { useRouter } from "@/i18n/navigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@zoonk/ui/components/alert-dialog";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type CancelPlusResult, cancelPlusAction } from "./cancel-plus-action";

export function CancelPlusButton({ endsNow = false }: { endsNow?: boolean }) {
  const t = useExtracted();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CancelPlusResult | null>(null);

  const cancel = () => {
    startTransition(async () => {
      const outcome = await cancelPlusAction().catch((): CancelPlusResult => "failed");
      setResult(outcome);

      if (outcome !== "failed") {
        setOpen(false);

        if (outcome === "unavailable") {
          router.refresh();
        }
      }
    });
  };

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger className={buttonVariants({ size: "sm", variant: "outline" })}>
        {t("Cancel Plus")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Cancel Plus?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {endsNow
              ? t("Plus ends right away, and we stop retrying your renewal payment.")
              : t("You keep Plus until the end of the period you already paid for.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {result === "failed" && (
          <p className="text-destructive-text text-sm" role="alert">
            {t("We couldn't cancel Plus. Try again or email {email}.", {
              email: t("hello@zoonk.com"),
            })}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("Go back")}</AlertDialogCancel>
          <Button busy={pending} onClick={cancel}>
            {t("Cancel Plus")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
