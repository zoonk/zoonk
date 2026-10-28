"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";
import { type PlusViewerState } from "./plus-plan";

export type ViewerVersions = Record<PlusViewerState["status"], ReactNode>;

/** While unknown, a browser whose session hint says it holds a session keeps the visitor's version out of sight. */
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

/** Only for parts below the first screen, where the swap moves nothing in sight. */
export function ViewerVersion({ versions }: { versions: ViewerVersions }) {
  const { known, status } = useViewer();

  return <div className={cn("contents", !known && "signed-in:hidden")}>{versions[status]}</div>;
}

const PLAN_NEXT_STEP_CLASS = "col-start-1 row-start-1 flex flex-col gap-2.5";

/** Another reader's version takes the room the visitor's holds, so nothing under it moves. */
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
