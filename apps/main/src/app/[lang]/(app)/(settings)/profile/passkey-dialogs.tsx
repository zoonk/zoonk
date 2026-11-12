"use client";

import { type PasskeyView } from "@zoonk/core/users/passkeys";
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
import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { Input } from "@zoonk/ui/components/input";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";

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
  isPending,
  onClose,
  onSave,
  passkey,
}: {
  isPending: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  passkey: PasskeyView;
}) {
  const t = useExtracted();
  const nameId = useId();
  const [name, setName] = useState(passkey.name ?? "");
  const trimmed = name.trim();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent closeLabel={t("Close")}>
        <DialogHeader>
          <DialogTitle>{t("Rename passkey")}</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(trimmed);
          }}
        >
          <label className="sr-only" htmlFor={nameId}>
            {t("Passkey name")}
          </label>
          <Input
            autoComplete="off"
            id={nameId}
            maxLength={MAX_NAME_LENGTH}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("Such as “MacBook” or “Phone”")}
            value={name}
          />

          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              {t("Cancel")}
            </Button>
            <Button busy={isPending} disabled={!trimmed || trimmed === passkey.name} type="submit">
              {t("Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
