"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { Button } from "@zoonk/ui/components/button";
import { PLUS_PLAN } from "@zoonk/utils/subscription";
import { changePlanAction } from "./_actions/change-plan";

/** Only for a free user or a Plus that staff gave: a store's subscription changes in the store. */
export function ChangePlanButton({
  hasPlus,
  userId,
  userName,
}: {
  hasPlus: boolean;
  userId: string;
  userName: string;
}) {
  return (
    <AdminConfirmDialog
      action={changePlanAction}
      confirmLabel={hasPlus ? "Remove Plus" : "Give Plus"}
      description={
        hasPlus
          ? "The Plus you gave them ends today."
          : "They get Plus at no charge until you remove it, and the certificates they've earned."
      }
      destructive={hasPlus}
      title={hasPlus ? `Remove ${userName}'s Plus?` : `Give ${userName} Plus?`}
      trigger={
        <Button size="sm" variant="outline">
          {hasPlus ? "Remove Plus" : "Give Plus"}
        </Button>
      }
    >
      <input name="userId" type="hidden" value={userId} />
      <input name="plan" type="hidden" value={hasPlus ? "free" : PLUS_PLAN.name} />
    </AdminConfirmDialog>
  );
}
