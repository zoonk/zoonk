"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { CheckIcon, RefreshCwIcon } from "lucide-react";
import {
  type ReviewFlagActionState,
  dismissReviewFlagAction,
  rewriteReviewFlagAction,
} from "./_actions/review-flag-actions";

const INITIAL_STATE: ReviewFlagActionState = { error: null, message: null, submissionId: 0 };

type ReviewFlagAction = (
  state: ReviewFlagActionState,
  formData: FormData,
) => Promise<ReviewFlagActionState>;

function sayingWhatItDid(action: ReviewFlagAction): ReviewFlagAction {
  return async (state, formData) => {
    const next = await action(state, formData);

    if (next.message) {
      showSuccessToast(next.message);
    }

    return next;
  };
}

/**
 * Dismissing is the decision only a person can make (this is still right), so it's the row's
 * button; a rewrite is what the daily run does anyway, so starting one now is the quiet action.
 */
export function ReviewFlagActions({ flagId }: { flagId: string }) {
  const [, rewriteAction] = useAdminActionState({
    action: sayingWhatItDid(rewriteReviewFlagAction),
    initialState: INITIAL_STATE,
  });

  const [, dismissAction] = useAdminActionState({
    action: sayingWhatItDid(dismissReviewFlagAction),
    initialState: INITIAL_STATE,
  });

  return (
    <div className="flex justify-end gap-2">
      <form action={rewriteAction}>
        <input name="flagId" type="hidden" value={flagId} />
        <AdminActionSubmitButton icon={<RefreshCwIcon />} variant="ghost">
          Rewrite now
        </AdminActionSubmitButton>
      </form>
      <form action={dismissAction}>
        <input name="flagId" type="hidden" value={flagId} />
        <AdminActionSubmitButton icon={<CheckIcon />}>Dismiss</AdminActionSubmitButton>
      </form>
    </div>
  );
}
