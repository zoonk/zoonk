"use client";

import { type ReviewTaskType } from "@/lib/review-utils";
import { Button } from "@zoonk/ui/components/button";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { unflagAction } from "../unflag-action";
import { approveFlaggedAction } from "./_actions/approve-flagged";

export function FlaggedItemActions({
  taskType,
  entityId,
}: {
  taskType: ReviewTaskType;
  entityId: string;
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      <form action={unflagAction}>
        <input type="hidden" name="taskType" value={taskType} />
        <input type="hidden" name="entityId" value={entityId} />
        <Button variant="outline" type="submit">
          Return to queue
        </Button>
      </form>

      <form action={approveFlaggedAction.bind(null, taskType, entityId)}>
        <SubmitButton>Mark as approved</SubmitButton>
      </form>
    </div>
  );
}
