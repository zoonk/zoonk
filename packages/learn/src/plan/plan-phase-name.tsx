"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { usePhaseName } from "./use-phase-name";

/**
 * A plan phase's name for screens outside the plan, such as a shared plan's public page: exam
 * phases by what they're for ("Fill the gaps"), the rest by their own name.
 */
export function PlanPhaseName({
  phase,
}: {
  phase: Pick<PlanPhaseView, "index" | "kind" | "name">;
}) {
  const phaseName = usePhaseName();
  return phaseName({ ...phase, short: null });
}
