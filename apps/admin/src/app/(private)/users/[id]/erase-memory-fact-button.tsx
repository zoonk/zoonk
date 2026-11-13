"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { Button } from "@zoonk/ui/components/button";
import { eraseMemoryFactAction } from "./_actions/erase-memory-fact";

/** Erasing is final, unlike the learner's own delete, which keeps 30 days of undo. */
export function EraseMemoryFactButton({ factId, userId }: { factId: string; userId: string }) {
  return (
    <AdminConfirmDialog
      action={eraseMemoryFactAction}
      confirmLabel="Erase"
      description="The fact and the older facts it replaced are removed for good. Use this for support requests to delete personal data."
      destructive
      title="Erase this fact?"
      trigger={
        <Button size="sm" variant="outline">
          Erase
        </Button>
      }
    >
      <input name="factId" type="hidden" value={factId} />
      <input name="userId" type="hidden" value={userId} />
    </AdminConfirmDialog>
  );
}
