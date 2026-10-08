"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { CheckIcon, RefreshCwIcon } from "lucide-react";
import { useActionState } from "react";
import {
  type ReviewFlagActionState,
  dismissReviewFlagAction,
  rewriteReviewFlagAction,
} from "./_actions/review-flag-actions";

const INITIAL_STATE: ReviewFlagActionState = { error: null, message: null };

/** "Rewrite now" and "Dismiss" for one flag, with the outcome of the last one below. */
export function ReviewFlagActions({ flagId }: { flagId: string }) {
  const [rewrite, rewriteAction] = useActionState(rewriteReviewFlagAction, INITIAL_STATE);
  const [dismiss, dismissAction] = useActionState(dismissReviewFlagAction, INITIAL_STATE);
  const outcome = [rewrite, dismiss].find((state) => state.error ?? state.message);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={rewriteAction}>
          <input name="flagId" type="hidden" value={flagId} />
          <AdminActionSubmitButton icon={<RefreshCwIcon />}>Rewrite now</AdminActionSubmitButton>
        </form>
        <form action={dismissAction}>
          <input name="flagId" type="hidden" value={flagId} />
          <AdminActionSubmitButton icon={<CheckIcon />}>Dismiss</AdminActionSubmitButton>
        </form>
      </div>
      {outcome ? (
        <p
          className={outcome.error ? "text-destructive text-xs" : "text-muted-foreground text-xs"}
          role="status"
        >
          {outcome.error ?? outcome.message}
        </p>
      ) : null}
    </div>
  );
}
