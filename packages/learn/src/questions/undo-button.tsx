"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { TASK_OPTION_CLASS } from "../_components/task-layout";

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
