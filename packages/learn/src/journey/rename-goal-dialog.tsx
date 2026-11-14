"use client";

import { MAX_GOAL_TITLE_LENGTH } from "@zoonk/core/goals/goal-input-limits";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { EditTextDialog } from "../_components/edit-text-dialog";
import { useChangeSaveFailed } from "../_components/save-error";

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
  const saveFailed = useChangeSaveFailed();
  const [pending, startTransition] = useTransition();

  return (
    <EditTextDialog
      isPending={pending}
      label={t({
        description: "A learning goal's name, not a person's name",
        id: "goalDisplayName",
        message: "Name",
      })}
      maxLength={MAX_GOAL_TITLE_LENGTH}
      onClose={onClose}
      onSave={(name) => {
        startTransition(async () => {
          const { data: saved } = await safeAsync(() => onRename(name));

          if (saved) {
            onClose();
          } else {
            saveFailed();
          }
        });
      }}
      title={t("Rename goal")}
      value={displayName}
    />
  );
}
