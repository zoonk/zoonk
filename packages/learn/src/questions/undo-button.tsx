"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";

/**
 * Undoes the plan change a result just made (lessons a test-out skipped, the focus a test set),
 * right where it was made: a quiet text action under the result's main one, on the column's left
 * edge; says so when it can't.
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
      <Button className="self-start" disabled={pending} onClick={onUndo} variant="link">
        {t("Undo")}
      </Button>
    </>
  );
}
