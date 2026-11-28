"use client";

import { CurrentPageLoginAnchor } from "@/components/current-page-login-link";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { EnterLink } from "@zoonk/ui/components/enter-button";
import { useExtracted } from "next-intl";

/**
 * Asks for a fresh login before a change that needs one. A dialog, so the page under it stays
 * where it is. `children` is the sentence that says what the login is for.
 */
export function SignInAgainDialog({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const t = useExtracted();

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Log in again")}</AlertDialogTitle>
          <AlertDialogDescription>{children}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
          <EnterLink href="/login" link={CurrentPageLoginAnchor}>
            {t("Log in again")}
          </EnterLink>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
