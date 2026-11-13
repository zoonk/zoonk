"use client";

import { MAX_GOAL_TITLE_LENGTH } from "@zoonk/core/goals/goal-input-limits";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { SheetHeader } from "../_components/sheet-header";

export function RenameGoalDialog({
  displayName,
  onRename,
  onClose,
}: {
  displayName: string;
  onRename: (name: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useExtracted();
  const id = useId();
  const [name, setName] = useState(displayName);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const trimmed = name.trim();

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open && !pending) {
          onClose();
        }
      }}
    >
      <DrawerPopup>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();

            if (!trimmed || pending) {
              return;
            }

            startTransition(async () => {
              const { data: saved } = await safeAsync(() => onRename(trimmed));
              setFailed(!saved);

              if (saved) {
                onClose();
              }
            });
          }}
        >
          <SheetHeader>
            <DrawerTitle>{t("Rename goal")}</DrawerTitle>
          </SheetHeader>
          <DrawerContent className="grid gap-2 pt-2">
            <Label htmlFor={id}>
              {t({
                description: "A learning goal's name, not a person's name",
                id: "goalDisplayName",
                message: "Name",
              })}
            </Label>
            <Input
              id={id}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_GOAL_TITLE_LENGTH}
              required
            />
            {failed && <ChangeSaveError />}
          </DrawerContent>
          <DrawerFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button type="submit" busy={pending} disabled={!trimmed}>
              {t("Save")}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerPopup>
    </Drawer>
  );
}
