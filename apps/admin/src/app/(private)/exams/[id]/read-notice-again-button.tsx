"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { Button } from "@zoonk/ui/components/button";
import { BookOpenTextIcon } from "lucide-react";
import { useState } from "react";
import { sendFreshnessCommandAction } from "../../sources/_actions/send-freshness-command";

export function ReadNoticeAgainButton({
  examBlueprintId,
  examName,
}: {
  examBlueprintId: string;
  examName: string;
}) {
  const [isReading, setIsReading] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <AdminConfirmDialog
        action={sendFreshnessCommandAction}
        confirmLabel="Read again"
        description="Zoonk reads the official notice with today's instructions. What changes reaches learners of this exam."
        onConfirmed={() => setIsReading(true)}
        title={`Read the notice of ${examName} again?`}
        trigger={
          <Button icon={<BookOpenTextIcon aria-hidden="true" />} size="sm" variant="outline">
            Read notice again
          </Button>
        }
      >
        <input name="command" type="hidden" value="readAgain" />
        <input name="targetId" type="hidden" value={examBlueprintId} />
        <input name="targetKind" type="hidden" value="exam" />
      </AdminConfirmDialog>

      <span aria-live="polite" className="text-muted-foreground text-xs empty:hidden">
        {isReading ? "Reading the notice again." : null}
      </span>
    </div>
  );
}
