"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";

/**
 * Undoes the plan change a result just made (lessons a test-out skipped, the focus a test set),
 * right where it was made; says so when it can't.
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
      {failed && (
        <p className="text-destructive text-center text-sm" role="alert">
          {t("That didn't go through. Try again in a moment.")}
        </p>
      )}
      <Button className="w-full" disabled={pending} onClick={onUndo} size="lg" variant="ghost">
        {t("Undo")}
      </Button>
    </>
  );
}
