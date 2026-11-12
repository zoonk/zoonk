"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { Button } from "@zoonk/ui/components/button";
import { RotateCcwIcon } from "lucide-react";
import { resetExamSkillGraphAction } from "./_actions/reset-exam-skill-graph";

export function ResetExamSkillGraphButton({
  examBlueprintId,
  examName,
}: {
  examBlueprintId: string;
  examName: string;
}) {
  return (
    <AdminConfirmDialog
      action={resetExamSkillGraphAction}
      confirmLabel="Reset"
      description="The skill graph is discarded. The next learner who adds this exam writes a new one."
      destructive
      title={`Reset the skill graph of ${examName}?`}
      trigger={
        <Button icon={<RotateCcwIcon aria-hidden="true" />} size="sm" variant="outline">
          Reset skill graph
        </Button>
      }
    >
      <input name="examBlueprintId" type="hidden" value={examBlueprintId} />
    </AdminConfirmDialog>
  );
}
