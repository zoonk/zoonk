"use client";

import { Button } from "@zoonk/ui/components/button";
import { Undo2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";

/** A bar's second action. A failure takes the line above the row, so the buttons stay put. */
export function UndoButton({
  disabled,
  failed,
  onUndo,
  pending,
}: {
  disabled?: boolean;
  failed: boolean;
  onUndo: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <>
      {failed && <ChangeSaveError className="order-first basis-full lg:text-right" />}
      <form action={onUndo} className="contents">
        <Button
          busy={pending}
          className="shrink-0"
          icon={<Undo2Icon aria-hidden="true" />}
          disabled={disabled}
          type="submit"
          size="xl"
          variant="outline"
        >
          {t("Undo")}
        </Button>
      </form>
    </>
  );
}

export type ResultUndo = {
  changeId: string | null | undefined;
  onUndo: (changeId: string) => Promise<boolean>;
};

export function useResultUndo({ changeId, onUndo }: ResultUndo) {
  const [undoneId, setUndoneId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const undone = Boolean(changeId && undoneId === changeId);

  const undo = () => {
    if (!changeId) {
      return;
    }

    startTransition(async () => {
      const saved = await onUndo(changeId).catch(() => false);
      setFailedId(saved ? null : changeId);

      if (saved) {
        setUndoneId(changeId);
      }
    });
  };

  return {
    button: (disabled: boolean) =>
      changeId &&
      !undone && (
        <UndoButton
          disabled={disabled}
          failed={failedId === changeId}
          onUndo={undo}
          pending={pending}
        />
      ),
    pending,
    undone,
  };
}
