"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { useAdminFormAction } from "@/lib/use-admin-action-state";
import { CheckIcon } from "lucide-react";
import { markAnalyticsRemovedAction } from "./_actions/mark-analytics-removed";

export function MarkAnalyticsRemovedForm({ deletionId }: { deletionId: string }) {
  const [state, formAction] = useAdminFormAction(markAnalyticsRemovedAction);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input name="deletionId" type="hidden" value={deletionId} />
        <AdminActionSubmitButton icon={<CheckIcon />}>
          Mark analytics removed
        </AdminActionSubmitButton>
      </form>

      <span
        aria-live="polite"
        className="text-destructive-text max-w-80 text-right text-xs empty:hidden"
        key={state.submissionId}
      >
        {state.error}
      </span>
    </div>
  );
}
