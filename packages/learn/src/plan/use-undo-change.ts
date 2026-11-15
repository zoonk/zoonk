"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { safeAsync } from "@zoonk/utils/error";
import { useTransition } from "react";
import { useChangeSaveFailed } from "../_components/save-error";
import { useStillMounted } from "../_utils/use-still-mounted";
import { useSharedRequest } from "./layout-shared";
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
  const isMounted = useStillMounted();
  const request = useSharedRequest("undo", isPending);

  const undo = () => {
    startTransition(async () => {
      const { data: undone } = await safeAsync(() =>
        request.track(actions.decide({ changeId: change.id, status: "undone" })),
      );

      startTransition(() => {
        if (!undone) {
          saveFailed();
          return;
        }

        editor.undo(change.id);

        if (isMounted()) {
          onUndone?.();
        }
      });
    });
  };

  return { isPending: request.busy, undo };
}
