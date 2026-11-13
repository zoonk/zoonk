"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { safeAsync } from "@zoonk/utils/error";
import { useTransition } from "react";
import { useChangeSaveFailed } from "../_components/save-error";
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
  const saveFailed = useChangeSaveFailed();

  const undo = () => {
    startTransition(async () => {
      const { data: undone } = await safeAsync(() =>
        actions.decide({ changeId: change.id, status: "undone" }),
      );

      startTransition(() => {
        if (undone) {
          editor.undo(change.id);
          onUndone?.();
        } else {
          saveFailed();
        }
      });
    });
  };

  return { isPending, undo };
}
