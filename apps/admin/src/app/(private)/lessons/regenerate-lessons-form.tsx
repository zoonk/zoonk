"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { RefreshCwIcon } from "lucide-react";
import { useActionState } from "react";
import {
  type RegenerateLessonsState,
  regenerateLessonsAction,
} from "./_actions/regenerate-lessons";

const INITIAL_STATE: RegenerateLessonsState = { error: null, regenerated: null, submissionId: 0 };

function formatLessonCount(count: number): string {
  return `${count.toLocaleString()} published ${count === 1 ? "lesson" : "lessons"}`;
}

/**
 * Shown when the list is filtered by a model or prompt version: rewrites the published lessons
 * that filter matches, a bounded batch per click, and says how many started.
 */
export function RegenerateLessonsForm({
  batchSize,
  matching,
  model,
  promptVersion,
}: {
  batchSize: number;
  matching: number;
  model?: string;
  promptVersion?: string;
}) {
  const [state, formAction] = useActionState(regenerateLessonsAction, INITIAL_STATE);

  return (
    <form
      action={formAction}
      className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
    >
      <input name="model" type="hidden" value={model ?? ""} />
      <input name="promptVersion" type="hidden" value={promptVersion ?? ""} />

      <div className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium">
          {formatLessonCount(matching)} {matching === 1 ? "matches" : "match"} this filter
        </span>
        <span className="text-muted-foreground text-xs">
          Rewriting takes up to {batchSize} of the oldest per click. They leave play until the new
          version passes the checks; learners keep their answers.
        </span>
        <span aria-live="polite" className="text-xs empty:hidden" key={state.submissionId}>
          {state.error ? <span className="text-destructive">{state.error}</span> : null}
          {state.regenerated === null
            ? null
            : `Started rewriting ${formatLessonCount(state.regenerated)}.`}
        </span>
      </div>

      {matching > 0 ? (
        <AdminActionSubmitButton icon={<RefreshCwIcon />}>Rewrite lessons</AdminActionSubmitButton>
      ) : null}
    </form>
  );
}
