"use client";

import { rememberAccountDeleted } from "@/app/[lang]/account-deleted-toast";
import { CurrentPageLoginLink } from "@/components/current-page-login-link";
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
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { LogInIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type DeleteAccountResult, deleteAccountAction } from "./delete-account-action";

const DELETE_BUTTON_CLASS = cn(
  buttonVariants({ size: "sm", variant: "outline" }),
  "text-destructive-text border-destructive/40 hover:bg-destructive/10 hover:text-destructive-text",
);

async function leaveDeletedAccount() {
  await safeAsync(forgetDeletedSession);
  rememberAccountDeleted();
  globalThis.location.assign("/");
}

function DeleteAccountOutcome({ result }: { result: DeleteAccountResult | null }) {
  const t = useExtracted();

  if (result === "signInAgain") {
    return (
      <div className="flex flex-col items-start gap-2 pb-3" role="alert">
        <p className="text-sm">{t("For your safety, log in again, then delete your account.")}</p>
        <CurrentPageLoginLink
          className={buttonVariants({ size: "sm", variant: "outline" })}
          icon={<LogInIcon aria-hidden="true" />}
        >
          {t("Log in again")}
        </CurrentPageLoginLink>
      </div>
    );
  }

  if (result === "failed") {
    return (
      <p className="text-destructive-text pb-3 text-sm" role="alert">
        {t("We couldn't delete your account. Try again or email hello@zoonk.com.")}
      </p>
    );
  }

  return null;
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
  const [result, setResult] = useState<DeleteAccountResult | null>(null);

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

      setResult(outcome);
    });
  };

  return (
    <div className="flex flex-col">
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

      <DeleteAccountOutcome result={result} />
    </div>
  );
}
