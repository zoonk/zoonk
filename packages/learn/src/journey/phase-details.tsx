"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { PopoverDescription, PopoverTitle } from "@zoonk/ui/components/popover";
import { useExtracted } from "next-intl";
import { PlusMark } from "../_components/plus-lock";
import { usePlanScreen } from "../plan/plan-context";
import { useFormatPlanDate } from "../plan/plan-date-text";
import { usePhaseName } from "../plan/use-phase-name";
import { JourneyChapters } from "./journey-chapters";
import { type JourneyPathLinks } from "./journey-links";
import { CheckpointRow, MockRow, usePhaseMocksLine } from "./journey-phase-events";
import { isNamedLikeAChapter } from "./path-phases";

/** "Oct 12 – Jan 24": a phase's days; estimated ones ahead (a learn plan's) by their month. */
function usePhaseRange() {
  const t = useExtracted();
  const formatPlanDate = useFormatPlanDate();

  return function phaseRange(phase: PlanPhaseView): string | null {
    if (!phase.startDate || !phase.endDate) {
      return null;
    }

    const month = phase.kind === "learn" && phase.state === "upcoming";

    return t("{start} – {end}", {
      end: formatPlanDate(phase.endDate, { month }),
      start: formatPlanDate(phase.startDate, { month }),
    });
  };
}

/** "1 of 92 lessons", that the phase is done, or that the plan holds nothing of it. */
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

/**
 * An exam's phase: its next mock (or how many it holds) and the challenge that closes it. Without
 * Plus its mocks show all the same, marked Plus.
 */
function ExamPhaseEvents({ links, phase }: { links: JourneyPathLinks; phase: PlanPhaseView }) {
  const { plan } = usePlanScreen();
  const mocksLine = usePhaseMocksLine();
  const { checkpoint, mocks } = phase;

  if (!mocks.nextDate && mocks.count === 0 && !checkpoint) {
    return null;
  }

  return (
    <ul className="flex flex-col">
      {mocks.nextDate && (
        <li>
          <MockRow
            challengeHref={links.challenge}
            date={mocks.nextDate}
            examHref={links.exam}
            locked={plan.access.mocksRequirePlus}
          />
        </li>
      )}

      {!mocks.nextDate && mocks.count > 0 && (
        <li className="text-muted-foreground flex items-center gap-2 py-1.5 text-xs">
          {mocksLine({ count: mocks.count, forNextSitting: false, nextSitting: null })}
          {plan.access.mocksRequirePlus && <PlusMark />}
        </li>
      )}

      {checkpoint && (
        <li>
          <CheckpointRow checkpoint={checkpoint} links={links} />
        </li>
      )}
    </ul>
  );
}

/**
 * What a phase of the roadmap holds, opened from its band: its name, its days and lessons, then an
 * exam's phase's next mock and closing challenge, or a learn or language phase's chapters, each
 * opening its page. Over chapters one of which has its name, it goes by its place
 * (`isNamedLikeAChapter`).
 */
export function PhaseDetails({ links, phase }: { links: JourneyPathLinks; phase: PlanPhaseView }) {
  const phaseName = usePhaseName();
  const phaseRange = usePhaseRange();
  const phaseLessons = usePhaseLessons();
  const { plan } = usePlanScreen();
  const range = phaseRange(phase);
  const listsChapters = phase.kind === "learn";
  const byPlace = listsChapters && isNamedLikeAChapter({ name: phaseName(phase), phase });

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <PopoverTitle>
          {phaseName(phase, { byPlace, mocksRequirePlus: plan.access.mocksRequirePlus })}
        </PopoverTitle>
        <PopoverDescription className="font-mono text-xs tabular-nums">
          {[range, phaseLessons(phase)].filter(Boolean).join(" · ")}
        </PopoverDescription>
      </div>

      {listsChapters ? (
        <JourneyChapters chapters={phase.chapters} checkpoint={phase.checkpoint} links={links} />
      ) : (
        <ExamPhaseEvents links={links} phase={phase} />
      )}
    </>
  );
}
