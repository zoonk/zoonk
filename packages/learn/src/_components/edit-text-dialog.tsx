"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { Input } from "@zoonk/ui/components/input";
import { Textarea } from "@zoonk/ui/components/textarea";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { useChangeSaveFailed } from "./save-error";
import { SheetHeader } from "./sheet-header";

/**
 * A sheet that edits one text: a title, an optional line, one field, Cancel and Save. Save stays
 * off until the text is there and differs from `value`. `onSave` resolves to whether the text was
 * saved: the sheet stays busy until then, closes when it was, and otherwise keeps the text to try
 * again. A caller that resolves false has said what went wrong; a save that throws gets the shared
 * "didn't save" toast.
 */
export function EditTextDialog({
  description,
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
  /** The field's name, read to screen readers. */
  label: string;
  maxLength: number;
  multiline?: boolean;
  onClose: () => void;
  onSave: (text: string) => Promise<boolean>;
  placeholder?: string;
  title: string;
  value: string;
}) {
  const t = useExtracted();
  const fieldId = useId();
  const [text, setText] = useState(value);
  const [isPending, startTransition] = useTransition();
  const saveFailed = useChangeSaveFailed();
  const trimmed = text.trim();
  const Field = multiline ? Textarea : Input;

  return (
    <Drawer
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DrawerPopup>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();

            startTransition(async () => {
              const { data: saved, error } = await safeAsync(() => onSave(trimmed));

              if (saved) {
                onClose();
              } else if (error) {
                saveFailed();
              }
            });
          }}
        >
          <SheetHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </SheetHeader>

          <DrawerContent className="pt-2">
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
          </DrawerContent>

          <DrawerFooter>
            <Button onClick={onClose} size="lg" type="button" variant="outline">
              {t("Cancel")}
            </Button>
            <Button
              busy={isPending}
              disabled={!trimmed || trimmed === value}
              size="lg"
              type="submit"
            >
              {t("Save")}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerPopup>
    </Drawer>
  );
}
