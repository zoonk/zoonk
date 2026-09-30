"use client";

import { Link } from "@/i18n/navigation";
import { forgetLearnerOnDevice } from "@/lib/logout";
import { authClient } from "@zoonk/auth/client";
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
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type DeleteAccountResult, deleteAccountAction } from "./delete-account-action";

const DELETE_ACCOUNT_ID = "delete-account";

/** The session is gone with the account, so the browser forgets it and starts fresh at home. */
async function leaveDeletedAccount() {
  await safeAsync(() => authClient.signOut());
  await forgetLearnerOnDevice();
  globalThis.location.assign("/");
}

function DeleteAccountOutcome({ result }: { result: DeleteAccountResult | null }) {
  const t = useExtracted();

  if (result === "signInAgain") {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-sm">{t("For your safety, sign in again, then delete your account.")}</p>
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href="/login"
          prefetch={false}
        >
          {t("Sign in again")}
        </Link>
      </div>
    );
  }

  if (result === "failed") {
    return (
      <p className="text-destructive text-sm" role="alert">
        {t("We couldn't delete your account. Try again or email hello@zoonk.com.")}
      </p>
    );
  }

  return null;
}

/**
 * Deleting the account removes everything in it for good, so it says what goes and asks once more
 * before doing it. Afterwards the learner is signed out and back on the home page.
 */
export function DeleteAccountSection() {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<DeleteAccountResult | null>(null);

  const deleteAccount = () => {
    startTransition(async () => {
      const { data } = await safeAsync(deleteAccountAction);
      const outcome = data ?? "failed";

      if (outcome === "deleted") {
        await leaveDeletedAccount();
        return;
      }

      setResult(outcome);
    });
  };

  return (
    <section aria-labelledby={DELETE_ACCOUNT_ID} className="flex flex-col gap-3 lg:max-w-md">
      <h2 className="text-base font-semibold" id={DELETE_ACCOUNT_ID}>
        {t("Delete account")}
      </h2>
      <p className="text-muted-foreground text-sm">
        {t(
          "Deletes your account and everything in it for good: goals, plans, progress, memory, feedback and uploads. Plus bought on the web is canceled; App Store purchases are managed in the App Store.",
        )}
      </p>

      <AlertDialog>
        <AlertDialogTrigger render={<Button className="w-fit" variant="destructive" />}>
          {t("Delete account")}
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete your account?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Your goals, plans, progress, memory, feedback and uploads are deleted for good. This can't be undone.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={deleteAccount} variant="destructive">
              {t("Delete my account")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteAccountOutcome result={result} />
    </section>
  );
}
