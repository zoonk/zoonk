"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { LogOutIcon } from "lucide-react";
import { revokeCliLoginAction } from "./_actions/revoke-cli-login";

export function RevokeCliLoginForm({ loginId }: { loginId: string }) {
  const [state, formAction] = useAdminActionState({
    action: revokeCliLoginAction,
    initialState: { error: null, submissionId: 0 },
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input name="loginId" type="hidden" value={loginId} />
        <AdminActionSubmitButton icon={<LogOutIcon />}>Revoke</AdminActionSubmitButton>
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
