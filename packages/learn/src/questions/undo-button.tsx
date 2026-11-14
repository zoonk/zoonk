"use client";

import { Button } from "@zoonk/ui/components/button";
import { Undo2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";

/** A bar's second action. A failure takes the line above the row, so the buttons stay put. */
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
      {failed && <ChangeSaveError className="order-first basis-full lg:text-right" />}
      <Button
        busy={pending}
        className="shrink-0"
        icon={<Undo2Icon aria-hidden="true" />}
        onClick={onUndo}
        size="xl"
        variant="outline"
      >
        {t("Undo")}
      </Button>
    </>
  );
}
