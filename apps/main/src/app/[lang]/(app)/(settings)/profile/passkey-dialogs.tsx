"use client";

import { type PasskeyView } from "@zoonk/core/users/passkeys";
import { EditTextDialog } from "@zoonk/learn/edit-text-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { useExtracted } from "next-intl";

const MAX_NAME_LENGTH = 50;

export function usePasskeyName(passkey: PasskeyView): string {
  const t = useExtracted();

  return (
    passkey.name ??
    t({
      description: "The name of a passkey the person hasn't named yet, in their list of passkeys.",
      id: "unnamedPasskey",
      message: "Passkey",
    })
  );
}

export function RenameDialog({
  onClose,
  onSave,
  passkey,
}: {
  onClose: () => void;
  onSave: (name: string) => Promise<boolean>;
  passkey: PasskeyView;
}) {
  const t = useExtracted();

  return (
    <EditTextDialog
      label={t("Passkey name")}
      maxLength={MAX_NAME_LENGTH}
      onClose={onClose}
      onSave={onSave}
      placeholder={t("Such as “MacBook” or “Phone”")}
      title={t("Rename passkey")}
      value={passkey.name ?? ""}
    />
  );
}

export function DeleteDialog({
  isPending,
  onClose,
  onDelete,
  passkey,
}: {
  isPending: boolean;
  onClose: () => void;
  onDelete: () => void;
  passkey: PasskeyView;
}) {
  const t = useExtracted();
  const name = usePasskeyName(passkey);

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
          <AlertDialogTitle>{t("Delete “{name}”?", { name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "It won't approve content fixes anymore. You'll confirm with one of your passkeys first.",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction busy={isPending} onClick={onDelete} variant="destructive">
            {t("Delete passkey")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
