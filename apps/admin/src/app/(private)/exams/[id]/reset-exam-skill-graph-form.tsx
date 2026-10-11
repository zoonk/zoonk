"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { RotateCcwIcon } from "lucide-react";
import { useActionState } from "react";
import {
  type ResetExamSkillGraphState,
  resetExamSkillGraphAction,
} from "./_actions/reset-exam-skill-graph";

const INITIAL_STATE: ResetExamSkillGraphState = { error: null, reset: false, submissionId: 0 };

/** "Reset" for an exam's shared skill graph, with the outcome below it. */
export function ResetExamSkillGraphForm({ examBlueprintId }: { examBlueprintId: string }) {
  const [state, formAction] = useActionState(resetExamSkillGraphAction, INITIAL_STATE);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input name="examBlueprintId" type="hidden" value={examBlueprintId} />
        <AdminActionSubmitButton icon={<RotateCcwIcon />}>Reset</AdminActionSubmitButton>
      </form>

      <span
        aria-live="polite"
        className={
          state.error
            ? "text-destructive max-w-80 text-right text-xs empty:hidden"
            : "text-muted-foreground max-w-80 text-right text-xs empty:hidden"
        }
        key={state.submissionId}
      >
        {state.error ?? (state.reset ? "Reset. The exam's next learner writes a new graph." : null)}
      </span>
    </div>
  );
}
