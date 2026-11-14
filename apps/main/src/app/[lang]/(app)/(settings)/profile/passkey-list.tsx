"use client";

import {
  type PasskeyChangeFailure,
  addPasskey,
  deletePasskey,
  renamePasskey,
} from "@zoonk/auth/passkey-client";
import { type PasskeyView } from "@zoonk/core/users/passkeys";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
} from "@zoonk/learn/list";
import { SettingRow } from "@zoonk/learn/setting-rows";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { safeAsync } from "@zoonk/utils/error";
import { EllipsisIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState, useTransition } from "react";
import { SignInAgainDialog } from "../_components/sign-in-again-dialog";
import { DeleteDialog, RenameDialog, usePasskeyName } from "./passkey-dialogs";
import { refreshPasskeysAction } from "./refresh-passkeys-action";

type PlainFailure = Exclude<PasskeyChangeFailure, "cancelled" | "signInAgain">;

function useFailureMessage(): (failure: PlainFailure) => string {
  const t = useExtracted();

  const messages: Record<PlainFailure, string> = {
    alreadyAdded: t("This device already has a passkey for your account."),
    failed: t("That didn't work. Try again in a moment."),
    notConfirmed: t("That wasn't confirmed with one of your passkeys. Try again."),
  };

  return (failure) => messages[failure];
}

function PasskeyRow({
  onDelete,
  onRename,
  passkey,
}: {
  onDelete: () => void;
  onRename: () => void;
  passkey: PasskeyView;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const name = usePasskeyName(passkey);

  return (
    <ListRow className="items-center gap-x-4">
      <ListRowContent>
        <ListRowTitle>{name}</ListRowTitle>
        {passkey.createdAt && (
          <ListRowDescription>
            {t("Added {date}", {
              date: format.dateTime(passkey.createdAt, { dateStyle: "medium" }),
            })}
          </ListRowDescription>
        )}
      </ListRowContent>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("Options for “{name}”", { name })}
              className="text-muted-foreground shrink-0"
              edge="end"
              size="icon"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem aria-haspopup="dialog" onClick={onRename}>
            <PencilIcon aria-hidden="true" />
            {t("Rename")}
          </DropdownMenuItem>
          <DropdownMenuItem aria-haspopup="dialog" onClick={onDelete} variant="destructive">
            <Trash2Icon aria-hidden="true" />
            {t("Delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ListRow>
  );
}

type OpenDialog = { kind: "delete" | "rename"; passkey: PasskeyView };

/** `passkeys` comes from the server again after every change, so the list keeps no copy of it. */
export function PasskeyList({ passkeys }: { passkeys: PasskeyView[] }) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const [asksLogin, setAsksLogin] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const failureMessage = useFailureMessage();

  /** Resolves to whether it changed; a failure has been said by then. */
  const settle = async (run: () => Promise<PasskeyChangeFailure | null>) => {
    const { data, error } = await safeAsync(run);
    await safeAsync(refreshPasskeysAction);
    const failure = error ? "failed" : data;

    if (failure === "signInAgain") {
      setDialog(null);
      setAsksLogin(true);
    } else if (failure && failure !== "cancelled") {
      showErrorToast(failureMessage(failure));
    }

    return failure === null;
  };

  const change = (run: () => Promise<PasskeyChangeFailure | null>) => {
    startTransition(async () => {
      await settle(run);
      setDialog(null);
    });
  };

  const add = () =>
    change(async () => {
      const added = await addPasskey();
      return added.status === "added" ? null : added.status;
    });

  const remove = (id: string) =>
    change(async () => {
      const deleted = await deletePasskey(id);
      return deleted === "deleted" ? null : deleted;
    });

  /** In the rename sheet's own save, which keeps the name typed if it didn't go through. */
  const rename = (id: string, name: string) =>
    settle(async () => {
      const renamed = await renamePasskey({ id, name });
      return renamed === "renamed" ? null : renamed;
    });

  return (
    <div className="flex flex-col gap-2">
      <ListGroup>
        {passkeys.map((passkey) => (
          <PasskeyRow
            key={passkey.id}
            onDelete={() => setDialog({ kind: "delete", passkey })}
            onRename={() => setDialog({ kind: "rename", passkey })}
            passkey={passkey}
          />
        ))}

        <SettingRow
          description={
            passkeys.length > 0
              ? t("You'll confirm with a passkey you already have first.")
              : t("Your fingerprint, face or screen lock on this device")
          }
          label={t("Add a passkey")}
        >
          <form action={add} className="contents">
            <Button
              aria-label={t("Add a passkey")}
              busy={isPending && !dialog}
              icon={<PlusIcon aria-hidden="true" />}
              size="sm"
              type="submit"
              variant="outline"
            >
              {t("Add")}
            </Button>
          </form>
        </SettingRow>
      </ListGroup>

      {asksLogin && (
        <SignInAgainDialog onClose={() => setAsksLogin(false)}>
          {t("For your safety, log in again, then add your passkey.")}
        </SignInAgainDialog>
      )}

      {dialog?.kind === "rename" && (
        <RenameDialog
          onClose={() => setDialog(null)}
          onSave={(name) => rename(dialog.passkey.id, name)}
          passkey={dialog.passkey}
        />
      )}

      {dialog?.kind === "delete" && (
        <DeleteDialog
          isPending={isPending}
          onClose={() => setDialog(null)}
          onDelete={() => remove(dialog.passkey.id)}
          passkey={dialog.passkey}
        />
      )}
    </div>
  );
}
