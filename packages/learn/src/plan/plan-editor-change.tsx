"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { SlidersHorizontalIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlanChangeSummary } from "./plan-change-applied";
import { useEditorChange } from "./plan-editor-change-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { useUndoChange } from "./use-undo-change";

function EditorChangeNote({ change }: { change: PlanChangeView }) {
  const t = useExtracted();
  const { failed, isPending, undo } = useUndoChange({ change });

  return (
    <>
      <PlanChangeSummary change={change} icon={SlidersHorizontalIcon} />
      {change.canUndo && (
        <Button
          className="self-start"
          disabled={isPending}
          focusableWhenDisabled
          onClick={undo}
          size="sm"
          variant="outline"
        >
          {t("Undo")}
        </Button>
      )}
      {failed && <PlanFailedMessage />}
    </>
  );
}

/**
 * The plan editor's latest change, under its controls: what it did, as a sheet's change says it,
 * with Undo while it's the plan's latest change; once undone, that the plan is back. A time or a
 * date changed in the editor re-plans at once, and nothing said so or offered a way back.
 */
export function PlanEditorChange() {
  const t = useExtracted();
  const latest = useEditorChange();

  if (!latest) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-t px-6 pt-4 pb-6">
      {latest.undone ? (
        <p className="font-medium" role="status">
          {t("Undone. Your plan is back as it was.")}
        </p>
      ) : (
        <EditorChangeNote change={latest.change} key={latest.change.id} />
      )}
    </div>
  );
}
