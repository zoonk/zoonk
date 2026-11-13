"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { type AdminActionState, useAdminActionState } from "@/lib/use-admin-action-state";
import { DetailMenu } from "@zoonk/ui/components/detail";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { CircleStopIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import {
  type FreshnessTargetKind,
  sendFreshnessCommandAction,
} from "./_actions/send-freshness-command";

/**
 * Checking only looks for a change, so it's one press. Stopping leaves learners on what Zoonk last
 * read, so it sits in the menu and asks first.
 */
export function FreshnessActions({
  targetId,
  targetKind,
  targetName,
}: {
  targetId: string;
  targetKind: FreshnessTargetKind;
  targetName: string;
}) {
  const [isStopOpen, setIsStopOpen] = useState(false);

  const [, checkNow] = useAdminActionState({
    action: async (previous: AdminActionState, formData: FormData) => {
      const { error } = await sendFreshnessCommandAction(formData);

      if (!error) {
        showSuccessToast("Checking now. A change updates what learners see.");
      }

      return { error, submissionId: previous.submissionId + 1 };
    },
    initialState: { error: null, submissionId: 0 },
  });

  const target = (
    <>
      <input name="targetId" type="hidden" value={targetId} />
      <input name="targetKind" type="hidden" value={targetKind} />
    </>
  );

  return (
    <>
      <form action={checkNow}>
        <input name="command" type="hidden" value="checkNow" />
        {target}
        <AdminActionSubmitButton icon={<RefreshCwIcon />}>Check now</AdminActionSubmitButton>
      </form>

      <DetailMenu label={targetKind === "exam" ? "Exam actions" : "Source actions"} size="sm">
        <DropdownMenuItem onClick={() => setIsStopOpen(true)}>
          <CircleStopIcon aria-hidden="true" />
          Stop checking
        </DropdownMenuItem>
      </DetailMenu>

      <AdminConfirmDialog
        action={sendFreshnessCommandAction}
        confirmLabel="Stop checking"
        description="Zoonk stops looking for changes to it. Checks start again when a learner's goal needs it."
        onConfirmed={() => showSuccessToast("Stopped checking.")}
        onOpenChange={setIsStopOpen}
        open={isStopOpen}
        title={`Stop checking ${targetName}?`}
      >
        <input name="command" type="hidden" value="stop" />
        {target}
      </AdminConfirmDialog>
    </>
  );
}
