"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { DrawerFooter } from "@zoonk/ui/components/drawer";
import { SlidersHorizontalIcon, Undo2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlanChangeSummary } from "./plan-change-applied";
import { useEditorChange } from "./plan-editor-change-context";
import { useUndoChange } from "./use-undo-change";

function EditorChangeNote({ change }: { change: PlanChangeView }) {
  const t = useExtracted();
  const { isPending, undo } = useUndoChange({ change });

  return (
    <PlanChangeSummary change={change} icon={SlidersHorizontalIcon}>
      {change.canUndo && (
        <Button
          busy={isPending}
          className="mt-1.5 self-start"
          icon={<Undo2Icon aria-hidden="true" />}
          onClick={undo}
          size="sm"
          variant="outline"
        >
          {t("Undo")}
        </Button>
      )}
    </PlanChangeSummary>
  );
}

/**
 * What the editor's last change did, with its Undo: the sheet's foot on a phone, a band under the
 * title in the side panel.
 */
export function PlanEditorChange({ placement }: { placement: "foot" | "top" }) {
  const t = useExtracted();
  const latest = useEditorChange();

  if (!latest) {
    return null;
  }

  const note = latest.undone ? (
    <p className="font-medium" role="status">
      {t("Undone. Your plan is back as it was.")}
    </p>
  ) : (
    <EditorChangeNote change={latest.change} key={latest.change.id} />
  );

  if (placement === "foot") {
    return <DrawerFooter note={note} />;
  }

  return <div className="flex flex-col gap-3 border-b px-6 pb-4">{note}</div>;
}
