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
import { Label } from "@zoonk/ui/components/label";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { useChangeSaveErrorMessage } from "../_components/save-error";

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
  const [pending, startTransition] = useTransition();
  const error = useChangeSaveErrorMessage();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();

            if (!name.trim() || pending) {
              return;
            }

            startTransition(async () => {
              const result = await safeAsync(() => onRename(name.trim()));

              if (result.data) {
                onClose();
              } else {
                showErrorToast(error);
              }
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("Rename goal")}</DialogTitle>
            <DialogDescription>
              {t("Choose a name you recognize. Your study plan stays the same.")}
            </DialogDescription>
          </DialogHeader>
          <div className="my-6 grid gap-2">
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
              maxLength={120}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button type="submit" busy={pending} disabled={!name.trim()}>
              {t("Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
