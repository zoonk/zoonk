"use client";

import { Link } from "@/i18n/navigation";
import { forgetDeletedSession } from "@/lib/forget-deleted-session";
import {
  LIST_ROW_INTERACTIVE_CLASS,
  ListGroup,
  ListRowContent,
  ListRowTitle,
} from "@zoonk/learn/list";
import { PageSectionFooter } from "@zoonk/learn/page";
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
import { safeAsync } from "@zoonk/utils/error";
import { TrashIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type DeleteAccountResult, deleteAccountAction } from "./delete-account-action";

const DELETE_ACCOUNT_ID = "delete-account";

/** The session is gone with the account, so the browser forgets it and starts fresh at home. */
async function leaveDeletedAccount() {
  await forgetDeletedSession();
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
    <section aria-labelledby={DELETE_ACCOUNT_ID} className="flex flex-col gap-3">
      <AlertDialog>
        <ListGroup>
          <AlertDialogTrigger className={LIST_ROW_INTERACTIVE_CLASS}>
            <span
              aria-hidden="true"
              className="bg-destructive/10 text-destructive flex size-8 shrink-0 items-center justify-center self-center rounded-lg"
            >
              <TrashIcon className="size-4" />
            </span>
            <ListRowContent>
              <ListRowTitle className="text-destructive" id={DELETE_ACCOUNT_ID}>
                {t("Delete account")}
              </ListRowTitle>
            </ListRowContent>
          </AlertDialogTrigger>
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

      <PageSectionFooter>
        {t(
          "Deletes your account and everything in it for good. Plus bought on the web is canceled; App Store purchases are managed in the App Store.",
        )}
      </PageSectionFooter>

      <DeleteAccountOutcome result={result} />
    </section>
  );
}
