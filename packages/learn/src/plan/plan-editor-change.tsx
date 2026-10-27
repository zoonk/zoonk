"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { SlidersHorizontalIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { PlanChangeSummary } from "./plan-change-applied";
import { useEditorChange } from "./plan-editor-change-context";
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
      {failed && <ChangeSaveError />}
    </>
  );
}

/**
 * The plan editor's latest change, by its controls (under its title in the panel, at the foot of
 * the phone's sheet): what it did, as a sheet's change says it, with Undo while it's the plan's
 * latest change; once undone, that the plan is back. A time or a date changed in the editor
 * re-plans at once, and nothing said so or offered a way back.
 */
export function PlanEditorChange({ className }: { className?: string }) {
  const t = useExtracted();
  const latest = useEditorChange();

  if (!latest) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-3 border-t px-6 pt-4 pb-6", className)}>
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
