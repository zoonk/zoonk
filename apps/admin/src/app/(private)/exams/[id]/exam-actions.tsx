"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { BookOpenTextIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { sendFreshnessCommandAction } from "../../sources/_actions/send-freshness-command";
import { FreshnessActions } from "../../sources/freshness-actions";
import { resetExamSkillGraphAction } from "./_actions/reset-exam-skill-graph";

/**
 * "Check now" is one press. Reading the notice again rewrites what learners see and resetting the
 * skill graph discards it, so both sit in the menu and ask first.
 */
export function ExamActions({
  examId,
  examName,
  hasNotice,
  hasSkillGraph,
}: {
  examId: string;
  examName: string;
  hasNotice: boolean;
  hasSkillGraph: boolean;
}) {
  const [dialog, setDialog] = useState<"read" | "reset" | null>(null);

  return (
    <>
      <FreshnessActions
        menuEnd={
          hasSkillGraph ? (
            <DropdownMenuItem onClick={() => setDialog("reset")} variant="destructive">
              <RotateCcwIcon aria-hidden="true" />
              Reset skill graph
            </DropdownMenuItem>
          ) : null
        }
        menuStart={
          hasNotice ? (
            <DropdownMenuItem onClick={() => setDialog("read")}>
              <BookOpenTextIcon aria-hidden="true" />
              Read notice again
            </DropdownMenuItem>
          ) : null
        }
        targetId={examId}
        targetKind="exam"
        targetName={examName}
      />

      <AdminConfirmDialog
        action={sendFreshnessCommandAction}
        confirmLabel="Read again"
        description="Zoonk reads the official notice with today's instructions. What changes reaches learners of this exam."
        onConfirmed={() => showSuccessToast("Reading the notice again.")}
        onOpenChange={(open) => setDialog(open ? "read" : null)}
        open={dialog === "read"}
        title={`Read the notice of ${examName} again?`}
      >
        <input name="command" type="hidden" value="readAgain" />
        <input name="targetId" type="hidden" value={examId} />
        <input name="targetKind" type="hidden" value="exam" />
      </AdminConfirmDialog>

      <AdminConfirmDialog
        action={resetExamSkillGraphAction}
        confirmLabel="Reset"
        description="The skill graph is discarded. The next learner who adds this exam writes a new one."
        destructive
        onConfirmed={() => showSuccessToast("Skill graph reset.")}
        onOpenChange={(open) => setDialog(open ? "reset" : null)}
        open={dialog === "reset"}
        title={`Reset the skill graph of ${examName}?`}
      >
        <input name="examBlueprintId" type="hidden" value={examId} />
      </AdminConfirmDialog>
    </>
  );
}
