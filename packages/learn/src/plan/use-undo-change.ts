"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { usePlanScreen } from "./plan-context";
import { useReportEditorChange } from "./plan-editor-change-context";

/**
 * Undoes a change the learner just made, with a pending state and a failure flag, the same way
 * wherever its note offers Undo (a sheet's answer, the plan editor's last change).
 */
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
