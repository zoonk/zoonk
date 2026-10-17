"use client";

import { rememberAccountDeleted } from "@/app/[lang]/account-deleted-toast";
import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { forgetDeletedSession } from "@/lib/forget-deleted-session";
import { ListGroup } from "@zoonk/learn/list";
import { PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
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
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type DeleteAccountResult, deleteAccountAction } from "./delete-account-action";

const DELETE_ACCOUNT_ID = "delete-account";

/** The row's small way to delete: see-through with a red line and red words, never a red slab. */
const DELETE_BUTTON_CLASS = cn(
  buttonVariants({ size: "sm", variant: "outline" }),
  "text-destructive-text border-destructive/40 hover:bg-destructive/10 hover:text-destructive-text",
);

/**
 * The session is gone with the account, so the browser forgets it and starts fresh at home, which
 * says the account was deleted.
 */
async function leaveDeletedAccount() {
  await forgetDeletedSession();
  rememberAccountDeleted();
  globalThis.location.assign("/");
}

function DeleteAccountOutcome({ result }: { result: DeleteAccountResult | null }) {
  const t = useExtracted();

  if (result === "signInAgain") {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-sm">{t("For your safety, sign in again, then delete your account.")}</p>
        <CurrentPageLoginLink className={buttonVariants({ size: "sm", variant: "outline" })}>
          {t("Sign in again")}
        </CurrentPageLoginLink>
      </div>
    );
  }

  if (result === "failed") {
    return (
      <p className="text-destructive-text text-sm" role="alert">
        {t("We couldn't delete your account. Try again or email hello@zoonk.com.")}
      </p>
    );
  }

  return null;
}

/**
 * Deleting the account as one row: what it removes for good as its description, and a small red
 * "Delete…" that asks once more before doing it. Afterwards the learner is signed out and back on
 * the home page, which confirms the account was deleted. It deletes only the account the page
 * shows (`userId`).
 */
export function DeleteAccountSection({ userId }: { userId: string }) {
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

      // Another account signed in since the page showed this one (in another tab): nothing was
      // deleted, and the page reloads for whoever is signed in now.
      if (outcome === "otherAccount") {
        globalThis.location.reload();
        return;
      }

      setResult(outcome);
    });
  };

  return (
    <PageSection aria-labelledby={DELETE_ACCOUNT_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={DELETE_ACCOUNT_ID}>{t("Delete account")}</PageSectionTitle>
      </PageSectionHeader>

      <AlertDialog>
        <ListGroup>
          <SettingRow
            description={t(
              "Deletes your account and everything in it for good. Plus bought on the web is canceled; App Store purchases are managed in the App Store.",
            )}
            label={t("Delete my account")}
          >
            <AlertDialogTrigger aria-label={t("Delete account")} className={DELETE_BUTTON_CLASS}>
              {t("Delete…")}
            </AlertDialogTrigger>
          </SettingRow>
        </ListGroup>

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
    </PageSection>
  );
}
