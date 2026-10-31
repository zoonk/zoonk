"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { BookOpenTextIcon } from "lucide-react";
import { useActionState } from "react";
import {
  type FreshnessCommandState,
  sendFreshnessCommandAction,
} from "../../sources/_actions/send-freshness-command";

const INITIAL_STATE: FreshnessCommandState = {
  command: null,
  error: null,
  result: null,
  submissionId: 0,
};

export function ReadNoticeAgainForm({ examBlueprintId }: { examBlueprintId: string }) {
  const [state, formAction] = useActionState(sendFreshnessCommandAction, INITIAL_STATE);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input name="command" type="hidden" value="readAgain" />
        <input name="targetId" type="hidden" value={examBlueprintId} />
        <input name="targetKind" type="hidden" value="exam" />
        <AdminActionSubmitButton icon={<BookOpenTextIcon />}>Read again</AdminActionSubmitButton>
      </form>

      <span
        aria-live="polite"
        className={
          state.error
            ? "text-destructive-text max-w-80 text-right text-xs empty:hidden"
            : "text-muted-foreground max-w-80 text-right text-xs empty:hidden"
        }
        key={state.submissionId}
      >
        {state.error ??
          (state.result === "started"
            ? "Reading the notice again. What changed reaches learners."
            : null)}
      </span>
    </div>
  );
}
