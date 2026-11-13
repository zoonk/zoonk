"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { Button } from "@zoonk/ui/components/button";
import { CheckIcon } from "lucide-react";
import { markAnalyticsRemovedAction } from "./_actions/mark-analytics-removed";

/** It asks first: once marked, nothing in Zoonk says this person's analytics still exist. */
export function MarkAnalyticsRemovedForm({
  deletionId,
  distinctId,
}: {
  deletionId: string;
  distinctId: string;
}) {
  return (
    <AdminConfirmDialog
      action={markAnalyticsRemovedAction}
      confirmLabel="Mark removed"
      description={
        <>
          <span className="font-mono text-xs break-all">{distinctId}</span> leaves this list for
          good. Do it only after deleting the person in PostHog.
        </>
      }
      title="Mark these analytics as removed?"
      trigger={
        <Button icon={<CheckIcon aria-hidden="true" />} size="sm" variant="outline">
          Mark removed
        </Button>
      }
    >
      <input name="deletionId" type="hidden" value={deletionId} />
    </AdminConfirmDialog>
  );
}
