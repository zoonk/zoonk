"use client";

import { useAdminFormAction } from "@/lib/use-admin-action-state";
import { Button } from "@zoonk/ui/components/button";
import { updateUserAnalyticsDisabledAction } from "./_actions/update-user-analytics-disabled";

export function AnalyticsTrackingForm({
  analyticsDisabled,
  userId,
}: {
  analyticsDisabled: boolean;
  userId: string;
}) {
  const [state, formAction] = useAdminFormAction(updateUserAnalyticsDisabledAction);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input name="userId" type="hidden" value={userId} />
        <input name="analyticsDisabled" type="hidden" value={String(!analyticsDisabled)} />
        <Button size="sm" type="submit" variant="outline">
          {analyticsDisabled ? "Include in analytics" : "Exclude from analytics"}
        </Button>
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
