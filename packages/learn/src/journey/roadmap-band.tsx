"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "../plan/plan-context";
import { usePhaseName } from "../plan/use-phase-name";
import { CurrentPhaseMark } from "./current-phase-mark";
import { BandTodayTick, EndDateSizer } from "./roadmap-lane";
import { BAND_CHECK_CLASS, BandName, splitBandName } from "./roadmap-styles";
import { getLessonShare } from "./use-roadmap";

const PERCENT = 100;

export function BandFace({
  isLast,
  phase,
  todayShare = null,
}: {
  isLast: boolean;
  phase: PlanPhaseView;
  todayShare?: number | null;
}) {
  const t = useExtracted();
  const phaseName = usePhaseName();
  const { plan } = usePlanScreen();
  const name = phaseName(phase, { mocksRequirePlus: plan.access.mocksRequirePlus });

  return (
    <>
      <BandName
        leading={
          phase.state === "current" ? (
            <CurrentPhaseMark className="mr-1.5 inline-block size-1.5 align-[0.08em] ring-2" />
          ) : (
            phase.state === "done" && <CheckIcon aria-hidden="true" className={BAND_CHECK_CLASS} />
          )
        }
        name={name}
      />
      {isLast && <EndDateSizer />}
      {phase.state === "current" && <span className="sr-only">{t(", you are here")}</span>}
      {phase.state === "done" && <span className="sr-only">{t(", done")}</span>}
      {phase.state === "current" && (
        // A tint over the part already covered, under the name: a line at the band's edge read as
        // a thicker ring.
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
        >
          <span
            className="bg-success/30 absolute inset-y-0 left-0"
            style={{ width: `${getLessonShare(phase) * PERCENT}%` }}
          />
        </span>
      )}
      {todayShare !== null && (
        <BandTodayTick nameLines={splitBandName(name)[1] ? 2 : 1} share={todayShare} />
      )}
    </>
  );
}
