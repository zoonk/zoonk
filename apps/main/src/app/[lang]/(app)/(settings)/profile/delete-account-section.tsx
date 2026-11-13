"use client";

import { rememberAccountDeleted } from "@/app/[lang]/account-deleted-toast";
import { forgetDeletedSession } from "@/lib/forget-deleted-session";
import { SettingRow } from "@zoonk/learn/setting-rows";
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
import { buttonVariants } from "@zoonk/ui/components/button";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { deleteAccountAction } from "./delete-account-action";
import { SignInAgainDialog } from "./sign-in-again-dialog";

const DELETE_BUTTON_CLASS = cn(
  buttonVariants({ size: "sm", variant: "outline" }),
  "text-destructive-text border-destructive/40 hover:bg-destructive/10 hover:text-destructive-text",
);

async function leaveDeletedAccount() {
  await safeAsync(forgetDeletedSession);
  rememberAccountDeleted();
  globalThis.location.assign("/");
}

/**
 * A row of the profile's "Your data" list. `plusNotice` says what happens to the learner's Plus,
 * which the server reads.
 */
export function DeleteAccountRow({
  plusNotice,
  userId,
}: {
  plusNotice: React.ReactNode;
  userId: string;
}) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const [asksLogin, setAsksLogin] = useState(false);

  const deleteAccount = () => {
    startTransition(async () => {
      const { data } = await safeAsync(() => deleteAccountAction(userId));
      const outcome = data ?? "failed";

      if (outcome === "deleted") {
        await leaveDeletedAccount();
        return;
      }

      if (outcome === "otherAccount") {
        globalThis.location.reload();
        return;
      }

      if (outcome === "signInAgain") {
        setAsksLogin(true);
        return;
      }

      showErrorToast(t("We couldn't delete your account. Try again or email hello@zoonk.com."));
    });
  };

  return (
    <>
      <AlertDialog>
        <SettingRow label={t("Delete my account")}>
          <AlertDialogTrigger aria-label={t("Delete account")} className={DELETE_BUTTON_CLASS}>
            {t("Delete…")}
          </AlertDialogTrigger>
        </SettingRow>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete your account?")}</AlertDialogTitle>
            <AlertDialogDescription className="flex flex-col gap-2" render={<div />}>
              <p>
                {t(
                  "Your goals, plans, progress, memory and uploads are deleted for good. This can't be undone.",
                )}
              </p>
              {plusNotice}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction busy={isPending} onClick={deleteAccount} variant="destructive">
              {t("Delete my account")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {asksLogin && (
        <SignInAgainDialog onClose={() => setAsksLogin(false)}>
          {t("For your safety, log in again, then delete your account.")}
        </SignInAgainDialog>
      )}
    </>
  );
}
