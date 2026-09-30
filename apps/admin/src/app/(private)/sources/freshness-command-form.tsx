"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { CircleStopIcon, RefreshCwIcon } from "lucide-react";
import { useActionState } from "react";
import {
  type FreshnessCommandState,
  type FreshnessTargetKind,
  sendFreshnessCommandAction,
} from "./_actions/send-freshness-command";

const INITIAL_STATE: FreshnessCommandState = {
  command: null,
  error: null,
  result: null,
  submissionId: 0,
};

/** What happened, in the admin's terms. */
function getResultMessage({ result }: FreshnessCommandState): string | null {
  if (result === "started") {
    return "Checking now. A change updates what learners see.";
  }

  if (result === "stopped") {
    return "Stopped. Checks start again when a learner's goal needs it.";
  }

  return null;
}

/**
 * "Check now" and "Stop" for an exam's or source's freshness checks. Both forms
 * share one state, so the line below shows the outcome of the last command.
 */
export function FreshnessCommandForm({
  targetId,
  targetKind,
}: {
  targetId: string;
  targetKind: FreshnessTargetKind;
}) {
  const [state, formAction] = useActionState(sendFreshnessCommandAction, INITIAL_STATE);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={formAction}>
          <input name="command" type="hidden" value="checkNow" />
          <input name="targetId" type="hidden" value={targetId} />
          <input name="targetKind" type="hidden" value={targetKind} />
          <AdminActionSubmitButton icon={<RefreshCwIcon />}>Check now</AdminActionSubmitButton>
        </form>

        <form action={formAction}>
          <input name="command" type="hidden" value="stop" />
          <input name="targetId" type="hidden" value={targetId} />
          <input name="targetKind" type="hidden" value={targetKind} />
          <AdminActionSubmitButton icon={<CircleStopIcon />}>Stop</AdminActionSubmitButton>
        </form>
      </div>

      <span
        aria-live="polite"
        className={
          state.error
            ? "text-destructive max-w-80 text-right text-xs empty:hidden"
            : "text-muted-foreground max-w-80 text-right text-xs empty:hidden"
        }
        key={state.submissionId}
      >
        {state.error ?? getResultMessage(state)}
      </span>
    </div>
  );
}
