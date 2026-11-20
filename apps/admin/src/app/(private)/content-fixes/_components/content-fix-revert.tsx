"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { Input } from "@zoonk/ui/components/input";
import { Undo2Icon } from "lucide-react";
import { useId, useState } from "react";
import { revertContentFixAction } from "../_actions/content-fix-actions";
import { INITIAL_STATE } from "./content-fix-decision";

export function RevertForm({ fixId }: { fixId: string }) {
  const reasonId = useId();

  // React resets uncontrolled fields after a form action, and a refused undo keeps what was typed.
  // An accepted one opens the new fix's page.
  const [reason, setReason] = useState("");

  const [, formAction] = useAdminActionState({
    action: revertContentFixAction,
    initialState: INITIAL_STATE,
  });

  return (
    <div className="flex max-w-2xl flex-col gap-2">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input name="fixId" type="hidden" value={fixId} />
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={reasonId}>
            Why undo it?
          </label>
          <Input
            id={reasonId}
            maxLength={2000}
            name="reason"
            onChange={(event) => setReason(event.target.value)}
            required
            value={reason}
          />
        </div>
        <AdminActionSubmitButton icon={<Undo2Icon />} size="lg">
          Propose undoing it
        </AdminActionSubmitButton>
      </form>

      <p className="text-muted-foreground text-sm text-pretty">
        Undoing is a new fix that puts back what this one replaced. It waits for review and changes
        nothing until it&apos;s approved with a passkey.
      </p>
    </div>
  );
}
