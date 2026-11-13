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
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { SheetHeader } from "./sheet-header";

/**
 * A sheet that edits one text: a title, an optional line, one field, Cancel and Save. Save stays
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
            onSave(trimmed);
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
            <Button onClick={onClose} type="button" variant="outline">
              {t("Cancel")}
            </Button>
            <Button busy={isPending} disabled={!trimmed || trimmed === value} type="submit">
              {t("Save")}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerPopup>
    </Drawer>
  );
}
