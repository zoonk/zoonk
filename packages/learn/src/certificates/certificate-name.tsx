"use client";

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
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";

/** Resolves false when it didn't save. The profile name is the one every certificate shows. */
export type SaveCertificateName = (name: string) => Promise<boolean>;

function useNameSave({
  onSaved,
  save,
}: {
  onSaved?: (name: string) => void;
  save: SaveCertificateName;
}) {
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (name: string) => {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    startTransition(async () => {
      const saved = await save(trimmed);
      setFailed(!saved);

      if (saved) {
        onSaved?.(trimmed);
      }
    });
  };

  return { failed, pending, submit };
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
  const [name, setName] = useState(current ?? "");
  const { failed, pending, submit } = useNameSave({ onSaved, save });

  return (
    <form
      className={cn("flex w-full max-w-md flex-col gap-2 text-left", className)}
      data-slot="certificate-name-field"
      onSubmit={(event) => {
        event.preventDefault();
        submit(name);
      }}
    >
      <label className="text-[0.8125rem] font-[550]" htmlFor={`${id}-name`}>
        {current ? t("Name on your certificates") : t("Your name, as it should appear")}
      </label>

      <div className="flex gap-2">
        <Input
          aria-describedby={`${id}-hint`}
          autoComplete="name"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- The field is what the learner asked for, or the one thing between them and sharing.
          autoFocus={Boolean(current)}
          id={`${id}-name`}
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
          aria-busy={pending || undefined}
          className="shrink-0"
          disabled={pending || !name.trim()}
          focusableWhenDisabled
          size="lg"
          type="submit"
        >
          {t("Save")}
        </Button>
      </div>

      <p className="text-muted-foreground text-xs leading-snug" id={`${id}-hint`}>
        {current
          ? t("Your certificates and your buddy use this name.")
          : t("Your certificates and your buddy use this name. You can change it anytime.")}
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
  const [name, setName] = useState(current ?? "");
  const { failed, pending, submit } = useNameSave({ onSaved: onClose, save });

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
        autoComplete="name"
        id={`${id}-name`}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("Your full name")}
        required
        value={name}
      />

      {failed && <ChangeSaveError />}

      <DialogFooter>
        <Button onClick={onClose} size="lg" type="button" variant="outline">
          {t("Cancel")}
        </Button>
        <Button
          aria-busy={pending || undefined}
          disabled={pending || !name.trim()}
          focusableWhenDisabled
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
            {t("It shows on every certificate and its link. Your buddy calls you by it too.")}
          </DialogDescription>
        </DialogHeader>

        <NameDialogForm current={current} onClose={() => onOpenChange(false)} save={save} />
      </DialogContent>
    </Dialog>
  );
}
