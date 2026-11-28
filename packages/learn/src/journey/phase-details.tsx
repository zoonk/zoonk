"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { DrawerContent, DrawerDescription, DrawerTitle } from "@zoonk/ui/components/drawer";
import { useExtracted } from "next-intl";
import { SheetHeader } from "../_components/sheet-header";
import { FactSegments } from "../_components/task-meta";
import { usePlanScreen } from "../plan/plan-context";
import { PlanDateText } from "../plan/plan-date-text";
import { usePhaseName } from "../plan/use-phase-name";
import { JourneyChapters } from "./journey-chapters";
import { type JourneyPathLinks } from "./journey-links";
import { CheckpointRow, MockRow, usePhaseMocksLine } from "./journey-phase-events";
import { usePhaseRowName } from "./path-phase-row";
import { isNamedLikeAChapter } from "./path-phases";
import { getPhaseStart } from "./phase-dates";
import { usePhaseEnd } from "./phase-when";

/** From the phase's start to the end it's named by everywhere (`usePhaseEnd`), or a short plan's days. */
function usePhaseRange() {
  const t = useExtracted();
  const phaseEnd = usePhaseEnd();

  return function phaseRange(phase: PlanPhaseView): React.ReactNode {
    const end = phaseEnd(phase);

    if (!end) {
      return null;
    }

    if ("days" in end) {
      return end.days;
    }

    if ("later" in end) {
      return t("Later");
    }

    const start = getPhaseStart({ end, phase });

    if (!start) {
      return null;
    }

    return t.rich("<start></start> – <end></end>", {
      end: () => <PlanDateText {...end} />,
      start: () => <PlanDateText {...start} />,
    });
  };
}

function usePhaseLessons() {
  const t = useExtracted();

  return function phaseLessons(phase: PlanPhaseView): string {
    if (phase.state === "leftOut") {
      return t("Not in your plan");
    }

    return phase.state === "done"
      ? t("Done")
      : t(
          "{total, plural, =0 {{done, number} of # lessons} one {{done, number} of # lesson} other {{done, number} of # lessons}}",
          { done: phase.lessonsDone, total: phase.lessonsTotal },
        );
  };
}

function ExamPhaseEvents({ links, phase }: { links: JourneyPathLinks; phase: PlanPhaseView }) {
  const mocksLine = usePhaseMocksLine();
  const { paused } = usePlanScreen();
  const { checkpoint, mocks } = phase;

  if (paused || (!mocks.nextDate && mocks.count === 0 && !checkpoint)) {
    return null;
  }

  return (
    <ul className="flex flex-col">
      {mocks.nextDate && (
        <li>
          <MockRow
            challengeHref={links.challenge}
            date={mocks.nextDate}
            planItemId={mocks.nextPlanItemId ?? null}
            examHref={links.exam}
          />
        </li>
      )}

      {!mocks.nextDate && mocks.count > 0 && (
        <li className="text-muted-foreground py-1.5 text-xs">
          {mocksLine({ count: mocks.count, forNextSitting: false, nextSitting: null })}
        </li>
      )}

      {checkpoint && (
        <li>
          <CheckpointRow checkpoint={checkpoint} links={links} phase={phase} />
        </li>
      )}
    </ul>
  );
}

export function PhaseDetails({ links, phase }: { links: JourneyPathLinks; phase: PlanPhaseView }) {
  const phaseName = usePhaseName();
  const phaseRowName = usePhaseRowName();
  const phaseRange = usePhaseRange();
  const phaseLessons = usePhaseLessons();
  const range = phaseRange(phase);
  const listsChapters = phase.kind === "learn";

  const byPlace =
    !phase.milestone &&
    phase.state !== "current" &&
    listsChapters &&
    isNamedLikeAChapter({ name: phaseName(phase), phase });

  return (
    <>
      <SheetHeader>
        <DrawerTitle>{byPlace ? phaseName(phase, { byPlace }) : phaseRowName(phase)}</DrawerTitle>
        <DrawerDescription className="font-mono text-xs text-balance tabular-nums">
          <FactSegments facts={[phaseLessons(phase)]} lead={range} />
        </DrawerDescription>
      </SheetHeader>

      <DrawerContent className="pt-2">
        {listsChapters ? (
          <JourneyChapters chapters={phase.chapters} links={links} phase={phase} />
        ) : (
          <ExamPhaseEvents links={links} phase={phase} />
        )}
      </DrawerContent>
    </>
  );
}
