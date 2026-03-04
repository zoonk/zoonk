"use client";

import { Button } from "@zoonk/ui/components/button";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { markNeedsChangesAction } from "../_actions/mark-needs-changes";
import { markReviewedAction } from "../_actions/mark-reviewed";

function NeedsChangesButton() {
  const status = useFormStatus();

  return (
    <Button variant="outline" type="submit" disabled={status.pending}>
      {status.pending ? <Loader2Icon className="animate-spin" /> : null}
      Needs changes
    </Button>
  );
}

export function ReviewActions({ taskType, entityId }: { taskType: string; entityId: string }) {
  return (
    <div className="flex items-center justify-between pt-4">
      <form action={markNeedsChangesAction}>
        <input type="hidden" name="taskType" value={taskType} />
        <input type="hidden" name="entityId" value={entityId} />
        <NeedsChangesButton />
      </form>

      <form action={markReviewedAction}>
        <input type="hidden" name="taskType" value={taskType} />
        <input type="hidden" name="entityId" value={entityId} />
        <SubmitButton>Looks good</SubmitButton>
      </form>
    </div>
  );
}
