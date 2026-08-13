"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { RefreshCwIcon } from "lucide-react";
import { useActionState } from "react";
import {
  type RetryLessonGenerationState,
  retryLessonGenerationAction,
} from "./_actions/retry-lesson-generation";

const INITIAL_STATE: RetryLessonGenerationState = { error: null, status: "idle", submissionId: 0 };

/**
 * Keeps retry feedback beside the failed lesson so an admin can start a fresh
 * workflow run without navigating away from the operational list.
 */
export function RetryLessonGenerationForm({ lessonId }: { lessonId: string }) {
  const [state, formAction] = useActionState(retryLessonGenerationAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input name="lessonId" type="hidden" value={lessonId} />
      <AdminActionSubmitButton icon={<RefreshCwIcon />}>
        {state.status === "success" ? "Started" : "Generate again"}
      </AdminActionSubmitButton>
      <span
        aria-live="polite"
        className="text-destructive max-w-48 text-right text-xs empty:hidden"
        key={state.submissionId}
      >
        {state.error}
      </span>
    </form>
  );
}
