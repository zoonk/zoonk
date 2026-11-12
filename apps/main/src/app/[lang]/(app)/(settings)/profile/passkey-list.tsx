"use client";

import { CurrentPageLoginLink } from "@/components/current-page-login-link";
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
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { safeAsync } from "@zoonk/utils/error";
import { EllipsisIcon, LogInIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState, useTransition } from "react";
import { DeleteDialog, RenameDialog, usePasskeyName } from "./passkey-dialogs";
import { refreshPasskeysAction } from "./refresh-passkeys-action";

function ChangeFailure({ failure }: { failure: PasskeyChangeFailure | null }) {
  const t = useExtracted();

  if (!failure || failure === "cancelled") {
    return null;
  }

  if (failure === "signInAgain") {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-sm">{t("For your safety, log in again, then add your passkey.")}</p>
        <CurrentPageLoginLink
          className={buttonVariants({ size: "sm", variant: "outline" })}
          icon={<LogInIcon aria-hidden="true" />}
        >
          {t("Log in again")}
        </CurrentPageLoginLink>
      </div>
    );
  }

  const messages: Record<Exclude<PasskeyChangeFailure, "cancelled" | "signInAgain">, string> = {
    alreadyAdded: t("This device already has a passkey for your account."),
    failed: t("That didn't work. Try again in a moment."),
    notConfirmed: t("That wasn't confirmed with one of your passkeys. Try again."),
  };

  return (
    <p className="text-destructive-text text-sm" role="alert">
      {messages[failure]}
    </p>
  );
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
              className="text-muted-foreground -mr-2 size-11 shrink-0"
              size="icon"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onRename}>
            <PencilIcon aria-hidden="true" />
            {t("Rename")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} variant="destructive">
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
  const [failure, setFailure] = useState<PasskeyChangeFailure | null>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);

  const change = (run: () => Promise<PasskeyChangeFailure | null>) => {
    startTransition(async () => {
      const { data, error } = await safeAsync(run);
      await safeAsync(refreshPasskeysAction);
      setFailure(error ? "failed" : data);
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

  const rename = (id: string, name: string) =>
    change(async () => {
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

      <ChangeFailure failure={failure} />

      {dialog?.kind === "rename" && (
        <RenameDialog
          isPending={isPending}
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
