"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { formatUsd } from "@/lib/ai-format";
import { RefreshCwIcon } from "lucide-react";
import { useActionState } from "react";
import {
  type CourseDetailsRewrite,
  type RegenerateCourseDetailsState,
  regenerateCourseDetailsAction,
} from "./_actions/regenerate-course-details";

const INITIAL_STATE: RegenerateCourseDetailsState = { error: null, rewrite: null, submissionId: 0 };

function formatCourseCount(count: number): string {
  return `${count.toLocaleString("en")} public ${count === 1 ? "course" : "courses"}`;
}

/** Every course costs the same to rewrite, so a click's share of the total follows its size. */
function getCostMessage({
  batchSize,
  estimatedCost,
  matching,
}: {
  batchSize: number;
  estimatedCost: number;
  matching: number;
}): string {
  if (matching <= batchSize) {
    return `One click rewrites them all for about ${formatUsd(estimatedCost)}.`;
  }

  const batchCost = (estimatedCost / matching) * batchSize;

  return `About ${formatUsd(estimatedCost)} for all of them. Each click rewrites up to ${batchSize}, oldest first, so the next costs about ${formatUsd(batchCost)}.`;
}

/** What the last click started. Courses that could not start keep their copy and stay in the set. */
function getRewriteMessage({ failed, started }: CourseDetailsRewrite): string {
  if (started === 0) {
    return "No courses left to rewrite.";
  }

  const startedMessage = `Started rewriting ${formatCourseCount(started)}.`;

  return failed === 0
    ? startedMessage
    : `${startedMessage} ${failed.toLocaleString("en")} could not start; click again to retry.`;
}

/**
 * Rewrites outdated or missing landing page copy on public courses, a bounded batch per click.
 * The estimated cost shows before anything starts.
 */
export function RegenerateCourseDetailsForm({
  batchSize,
  estimatedCost,
  matching,
}: {
  batchSize: number;
  estimatedCost: number;
  matching: number;
}) {
  const [state, formAction] = useActionState(regenerateCourseDetailsAction, INITIAL_STATE);

  return (
    <form
      action={formAction}
      className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
    >
      <div className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium">
          {matching === 0
            ? "No public course has outdated or missing page copy"
            : `${formatCourseCount(matching)} ${matching === 1 ? "has" : "have"} outdated or missing page copy`}
        </span>

        {matching > 0 ? (
          <span className="text-muted-foreground text-xs">
            Outdated or missing copy is rewritten automatically each day.{" "}
            {getCostMessage({ batchSize, estimatedCost, matching })} Only the landing page copy is
            cleared and rewritten; descriptions and categories stay.
          </span>
        ) : null}

        <span aria-live="polite" className="text-xs empty:hidden" key={state.submissionId}>
          {state.error ? <span className="text-destructive-text">{state.error}</span> : null}
          {state.rewrite ? getRewriteMessage(state.rewrite) : null}
        </span>
      </div>

      {matching > 0 ? (
        <AdminActionSubmitButton icon={<RefreshCwIcon />}>Run a batch now</AdminActionSubmitButton>
      ) : null}
    </form>
  );
}
