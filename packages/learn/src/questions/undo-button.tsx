"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { TASK_OPTION_CLASS } from "../_components/task-layout";

/**
 * Undoes the plan change a result just made (lessons a test-out skipped, the focus a test set),
 * right where it was made: a quiet option under the result's main action; says so when it can't.
 */
export function UndoButton({
  failed,
  onUndo,
  pending,
}: {
  failed: boolean;
  onUndo: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <>
      {failed && <ChangeSaveError />}
      <Button
        className={TASK_OPTION_CLASS}
        disabled={pending}
        onClick={onUndo}
        size="xl"
        variant="ghost"
      >
        {t("Undo")}
      </Button>
    </>
  );
}
