"use client";

import { MAX_GOAL_TITLE_LENGTH } from "@zoonk/core/goals/goal-input-limits";
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
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";

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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) {
          onClose();
        }
      }}
    >
      <DialogContent closeLabel={t("Close")}>
        <form
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
              maxLength={MAX_GOAL_TITLE_LENGTH}
              required
            />
            {failed && <ChangeSaveError />}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button type="submit" busy={pending} disabled={!trimmed}>
              {t("Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
