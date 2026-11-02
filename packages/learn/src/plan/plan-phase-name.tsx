"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { usePhaseName } from "./use-phase-name";

export function PlanPhaseName({
  phase,
}: {
  phase: Pick<PlanPhaseView, "index" | "kind" | "name">;
}) {
  const phaseName = usePhaseName();
  return phaseName({ ...phase, short: null });
}
