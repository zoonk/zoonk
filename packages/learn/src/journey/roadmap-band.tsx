"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "../plan/plan-context";
import { usePhaseName } from "../plan/use-phase-name";
import { BAND_CHECK_CLASS, BAND_NAME_CLASS } from "./roadmap-styles";
import { getLessonShare } from "./use-roadmap";

const PERCENT = 100;

export function BandFace({ phase }: { phase: PlanPhaseView }) {
  const t = useExtracted();
  const phaseName = usePhaseName();
  const { plan } = usePlanScreen();

  return (
    <>
      <span className={BAND_NAME_CLASS}>
        {phase.state === "done" && (
          <CheckIcon aria-hidden="true" className={BAND_CHECK_CLASS} strokeWidth={2.5} />
        )}
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
