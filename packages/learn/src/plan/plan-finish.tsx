"use client";

import { PickedTimeFinish } from "../_components/finish-readout";
import { getAimAhead } from "../language-aim/aim-ahead";
import { usePlanScreen } from "./plan-context";

/** When the saved schedule finishes the plan, beside its daily time; dimmed while a change saves. */
export function PlanFinish({ pending }: { pending: boolean }) {
  const { paused, plan, today } = usePlanScreen();
  const { endDate } = plan.estimate;

  // The end is the saved schedule's last day, laid out again only by a change: once it has
  // passed, it no longer says when the learner finishes.
  const shown = !paused && !plan.end && (endDate === null || endDate >= today);

  return (
    <PickedTimeFinish
      aim={getAimAhead(plan.languageAim)}
      forecast={shown ? plan.estimate : null}
      updating={pending}
    />
  );
}
