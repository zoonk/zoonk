"use client";

import { MAX_GOAL_TITLE_LENGTH } from "@zoonk/core/goals/goal-input-limits";
import { useExtracted } from "next-intl";
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

  return (
    <EditTextDialog
      label={t({
        description: "A learning goal's name, not a person's name",
        id: "goalDisplayName",
        message: "Name",
      })}
      maxLength={MAX_GOAL_TITLE_LENGTH}
      onClose={onClose}
      onSave={async (name) => {
        const saved = await onRename(name);

        if (!saved) {
          saveFailed();
        }

        return saved;
      }}
      title={t("Rename goal")}
      value={displayName}
    />
  );
}
