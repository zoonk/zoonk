"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { Button } from "@zoonk/ui/components/button";
import { LogOutIcon } from "lucide-react";
import { revokeCliLoginsAction } from "./_actions/revoke-cli-logins";

export function RevokeCliLoginsForm({ name, userId }: { name: string; userId: string }) {
  return (
    <AdminConfirmDialog
      action={revokeCliLoginsAction}
      confirmLabel="Revoke"
      description="Their CLI logins end on every machine. They can log in again."
      destructive
      title={`Revoke ${name}'s CLI access?`}
      trigger={
        <Button icon={<LogOutIcon aria-hidden="true" />} size="sm" variant="outline">
          Revoke CLI access
        </Button>
      }
    >
      <input name="userId" type="hidden" value={userId} />
    </AdminConfirmDialog>
  );
}
