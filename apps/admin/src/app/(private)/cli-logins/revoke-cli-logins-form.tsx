"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { LogOutIcon } from "lucide-react";
import { revokeCliLoginsAction } from "./_actions/revoke-cli-logins";

export function RevokeCliLoginsForm({ name, userId }: { name: string; userId: string }) {
  const [state, formAction] = useAdminActionState({
    action: revokeCliLoginsAction,
    initialState: { error: null, submissionId: 0 },
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input name="userId" type="hidden" value={userId} />
        <AdminActionSubmitButton icon={<LogOutIcon />}>
          Revoke all<span className="sr-only"> of {name}&apos;s CLI logins</span>
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
