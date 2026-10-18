"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "../plan/plan-context";
import { usePhaseName } from "../plan/use-phase-name";
import { getLessonShare } from "./use-roadmap";

const PERCENT = 100;

/** The band's face: the phase's name (a check before a done one's), and the current one's fill. */
export function BandFace({ phase }: { phase: PlanPhaseView }) {
  const t = useExtracted();
  const phaseName = usePhaseName();
  const { plan } = usePlanScreen();

  return (
    <>
      {phase.state === "done" && (
        <CheckIcon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.5} />
      )}
      <span className="min-w-0 truncate">
        {phaseName(phase, { mocksRequirePlus: plan.access.mocksRequirePlus })}
      </span>
      {phase.state === "current" && <span className="sr-only">{t(", you are here")}</span>}
      {phase.state === "done" && <span className="sr-only">{t(", done")}</span>}
      {phase.state === "current" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        >
          <span
            className="bg-success absolute bottom-0 left-0 h-0.5"
            style={{ width: `${getLessonShare(phase) * PERCENT}%` }}
          />
        </span>
      )}
    </>
  );
}
