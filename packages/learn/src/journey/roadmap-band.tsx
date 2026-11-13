"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "../plan/plan-context";
import { usePhaseName } from "../plan/use-phase-name";
import { EndDateSizer } from "./roadmap-lane";
import { BAND_CHECK_CLASS, BandName } from "./roadmap-styles";
import { getLessonShare } from "./use-roadmap";

const PERCENT = 100;

export function BandFace({ isLast, phase }: { isLast: boolean; phase: PlanPhaseView }) {
  const t = useExtracted();
  const phaseName = usePhaseName();
  const { plan } = usePlanScreen();
  const name = phaseName(phase, { mocksRequirePlus: plan.access.mocksRequirePlus });

  return (
    <>
      <BandName
        leading={
          phase.state === "done" && <CheckIcon aria-hidden="true" className={BAND_CHECK_CLASS} />
        }
        name={name}
      />
      {isLast && <EndDateSizer />}
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
