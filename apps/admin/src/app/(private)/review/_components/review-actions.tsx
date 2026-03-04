"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { markReviewedAction } from "../_actions/mark-reviewed";

export function ReviewActions({
  taskType,
  entityId,
  skipUrl,
}: {
  taskType: string;
  entityId: string;
  skipUrl: string;
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      <a href={skipUrl} className={buttonVariants({ variant: "outline" })}>
        Skip
      </a>

      <form action={markReviewedAction}>
        <input type="hidden" name="taskType" value={taskType} />
        <input type="hidden" name="entityId" value={entityId} />
        <SubmitButton>Looks good</SubmitButton>
      </form>
    </div>
  );
}
