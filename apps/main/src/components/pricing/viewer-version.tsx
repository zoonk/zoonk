"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";
import { type PlusViewerState } from "./plus-plan";

/** A part of the pricing page in one version for each reader, rendered on the server. */
export type ViewerVersions = Record<PlusViewerState["status"], ReactNode>;

/**
 * Who's reading, from the learner summary in the browser: a visitor until it reads someone (or
 * when it can't), so the static page keeps what its HTML has until then. While it isn't known
 * (`known`), a browser whose session hint says it holds a session keeps the visitor's version out
 * of sight (`signed-in:`), since it's someone's with an account or a guest's.
 */
function useViewer(): { known: boolean; status: PlusViewerState["status"] } {
  const learner = useLearnerSummary();

  if (learner.status !== "ready") {
    return { known: learner.status === "visitor", status: "visitor" };
  }

  if (learner.summary.identity.isAnonymous) {
    return { known: true, status: "guest" };
  }

  return { known: true, status: learner.summary.tier === "plus" ? "subscribed" : "free" };
}

/**
 * The reader's version of a part of the page, the visitor's (what the HTML has) until the learner
 * summary reads someone. For parts below the first screen, where the swap moves nothing in sight.
 */
export function ViewerVersion({ versions }: { versions: ViewerVersions }) {
  const { known, status } = useViewer();

  return <div className={cn("contents", !known && "signed-in:hidden")}>{versions[status]}</div>;
}

/** A plan's action with the quiet line under it. */
const PLAN_NEXT_STEP_CLASS = "col-start-1 row-start-1 flex flex-col gap-2.5";

/**
 * A plan card's next step (its action and the line under it) for whoever is reading. The HTML has
 * the visitor's; another reader's takes its place once the learner summary reads them, in the room
 * the visitor's holds, so the card's rows and everything under it stay where they were.
 */
export function PlanNextStepVersion({ versions }: { versions: ViewerVersions }) {
  const { known, status } = useViewer();
  const isVisitor = status === "visitor";

  return (
    <div className="mt-5 grid">
      <div
        className={cn(
          PLAN_NEXT_STEP_CLASS,
          !isVisitor && "invisible",
          !known && "signed-in:invisible",
        )}
        inert={!isVisitor}
      >
        {versions.visitor}
      </div>

      {!isVisitor && <div className={PLAN_NEXT_STEP_CLASS}>{versions[status]}</div>}
    </div>
  );
}
