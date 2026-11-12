"use client";

import { isNameChangeTooLong } from "@zoonk/auth/name-rules";
import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";

/** Resolves false when it didn't save. The profile name is the one every certificate shows. */
export type SaveCertificateName = (name: string) => Promise<boolean>;

function checkName({ current, name }: { current: string | null; name: string }) {
  const trimmed = name.trim();
  const isTooLong = isNameChangeTooLong({ name, savedName: current ?? "" });
  return { isTooLong, trimmed, valid: Boolean(trimmed) && !isTooLong };
}

function useNameSave({
  current,
  onSaved,
  save,
}: {
  current: string | null;
  onSaved?: (name: string) => void;
  save: SaveCertificateName;
}) {
  const [name, setName] = useState(current ?? "");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const { isTooLong, valid } = checkName({ current, name });
  const canSave = !pending && valid;

  const submit = (value: string) => {
    const check = checkName({ current, name: value });

    if (pending || !check.valid) {
      return;
    }

    startTransition(async () => {
      const { data: saved } = await safeAsync(() => save(check.trimmed));
      setFailed(!saved);

      if (saved) {
        onSaved?.(check.trimmed);
      }
    });
  };

  return { canSave, failed, isTooLong, name, pending, setName, submit };
}

function NameHint({ isTooLong }: { isTooLong: boolean }) {
  const t = useExtracted();

  if (isTooLong) {
    return <span className="text-destructive-text">{t("Use 150 characters or fewer.")}</span>;
  }

  return t("Your certificates and your buddy use this name.");
}

/** In place on the award moment and on the page, while there's no name to print or a change to make. */
export function CertificateNameField({
  className,
  current,
  onCancel,
  onSaved,
  save,
}: {
  className?: string;
  current: string | null;
  onCancel?: () => void;
  onSaved?: (name: string) => void;
  save: SaveCertificateName;
}) {
  const t = useExtracted();
  const id = useId();

  const { canSave, failed, isTooLong, name, pending, setName, submit } = useNameSave({
    current,
    onSaved,
    save,
  });

  return (
    <form
      action={(formData) => {
        const value = formData.get("name");
        submit(typeof value === "string" ? value : "");
      }}
      className={cn("flex w-full max-w-md flex-col gap-2 text-left", className)}
      data-slot="certificate-name-field"
    >
      <label className="text-[0.8125rem] font-[550]" htmlFor={`${id}-name`}>
        {current ? t("Name on your certificates") : t("Your name, as it should appear")}
      </label>

      <div className="flex gap-2">
        <Input
          aria-describedby={`${id}-hint`}
          aria-invalid={isTooLong}
          autoComplete="name"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- The field is what the learner asked for, or the one thing between them and sharing.
          autoFocus={Boolean(current)}
          id={`${id}-name`}
          name="name"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && onCancel) {
              event.stopPropagation();
              onCancel();
            }
          }}
          placeholder={t("Your full name")}
          required
          value={name}
        />
        <Button
          busy={pending}
          className="shrink-0"
          disabled={!canSave}
          focusableWhenDisabled
          icon={<CheckIcon aria-hidden="true" />}
          size="lg"
          type="submit"
        >
          {t("Save")}
        </Button>
      </div>

      <p className="text-muted-foreground text-xs leading-snug" id={`${id}-hint`}>
        <NameHint isTooLong={isTooLong} />
      </p>

      {failed && <ChangeSaveError />}
    </form>
  );
}

/** Mounted only while the dialog is open, so every opening starts from the saved name. */
function NameDialogForm({
  current,
  onClose,
  save,
}: {
  current: string | null;
  onClose: () => void;
  save: SaveCertificateName;
}) {
  const t = useExtracted();
  const id = useId();

  const { canSave, failed, isTooLong, name, pending, setName, submit } = useNameSave({
    current,
    onSaved: onClose,
    save,
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit(name);
      }}
    >
      <label className="sr-only" htmlFor={`${id}-name`}>
        {t("Name on your certificates")}
      </label>
      <Input
        aria-describedby={isTooLong ? `${id}-error` : undefined}
        aria-invalid={isTooLong}
        autoComplete="name"
        id={`${id}-name`}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("Your full name")}
        required
        value={name}
      />

      {isTooLong && (
        <p className="text-destructive-text text-sm" id={`${id}-error`}>
          {t("Use 150 characters or fewer.")}
        </p>
      )}

      {failed && <ChangeSaveError />}

      <DialogFooter>
        <Button onClick={onClose} size="lg" type="button" variant="outline">
          {t("Cancel")}
        </Button>
        <Button
          busy={pending}
          disabled={!canSave}
          focusableWhenDisabled
          icon={<CheckIcon aria-hidden="true" />}
          size="lg"
          type="submit"
        >
          {t("Save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CertificateNameDialog({
  current,
  onOpenChange,
  open,
  save,
}: {
  current: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  save: SaveCertificateName;
}) {
  const t = useExtracted();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent closeLabel={t("Close")}>
        <DialogHeader>
          <DialogTitle>{t("Name on your certificates")}</DialogTitle>
          <DialogDescription>
            {t("Your certificates and your buddy use this name.")}
          </DialogDescription>
        </DialogHeader>

        <NameDialogForm current={current} onClose={() => onOpenChange(false)} save={save} />
      </DialogContent>
    </Dialog>
  );
}
