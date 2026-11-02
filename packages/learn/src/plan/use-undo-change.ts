"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { usePlanScreen } from "./plan-context";
import { useReportEditorChange } from "./plan-editor-change-context";

export function useUndoChange({
  change,
  onUndone,
}: {
  change: Pick<PlanChangeView, "id">;
  onUndone?: () => void;
}) {
  const { actions } = usePlanScreen();
  const editor = useReportEditorChange();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const undo = () => {
    setFailed(false);

    startTransition(async () => {
      const { data: undone } = await safeAsync(() =>
        actions.decide({ changeId: change.id, status: "undone" }),
      );

      startTransition(() => {
        if (undone) {
          editor.undo(change.id);
          onUndone?.();
        } else {
          setFailed(true);
        }
      });
    });
  };

  return { failed, isPending, undo };
}
