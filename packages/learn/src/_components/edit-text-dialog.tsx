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
import { Textarea } from "@zoonk/ui/components/textarea";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";

/**
 * A dialog that edits one text: a title, an optional line, one field, Cancel and Save. Save stays
 * off until the text is there and differs from `value`.
 */
export function EditTextDialog({
  description,
  isPending = false,
  label,
  maxLength,
  multiline = false,
  onClose,
  onSave,
  placeholder,
  title,
  value,
}: {
  description?: string;
  isPending?: boolean;
  /** The field's name, read to screen readers. */
  label: string;
  maxLength: number;
  multiline?: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  placeholder?: string;
  title: string;
  value: string;
}) {
  const t = useExtracted();
  const fieldId = useId();
  const [text, setText] = useState(value);
  const trimmed = text.trim();
  const Field = multiline ? Textarea : Input;

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
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(trimmed);
          }}
        >
          <label className="sr-only" htmlFor={fieldId}>
            {label}
          </label>
          <Field
            autoComplete="off"
            id={fieldId}
            maxLength={maxLength}
            onChange={(event) => setText(event.target.value)}
            placeholder={placeholder}
            value={text}
          />

          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              {t("Cancel")}
            </Button>
            <Button busy={isPending} disabled={!trimmed || trimmed === value} type="submit">
              {t("Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
