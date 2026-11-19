"use client";

import { type PlanRevealDays } from "@zoonk/core/view-models/today/plan-reveal";
import { DayStepOpener } from "../../session/day-step-opener";
import { type DayStep } from "../../session/session-types";
import { isFinished } from "../../today/today-queue";

/** The day's next step when it can open now; null sends Start to Today instead. */
export function findRevealStart(reveal: PlanRevealDays | null): DayStep | null {
  const session = reveal?.today;
  const next = session?.blocks.find((block) => block.position === session.nextPosition);
  return next && !isFinished(next) && !next.waitReason ? next : null;
}

/**
 * Start opens the day's step through the opener Today uses, which ends the reveal (`markRevealed`)
 * first, so Today never sends the learner back here. Null without a day to open.
 */
export function RevealDayOpener({
  children,
  goalId,
  markRevealed,
  refresh,
  reveal,
}: {
  children: (open: ((step: DayStep) => Promise<boolean>) | null) => React.ReactNode;
  goalId: string;
  markRevealed: () => Promise<boolean>;
  refresh: () => void;
  reveal: PlanRevealDays | null;
}) {
  if (!reveal) {
    return children(null);
  }

  return (
    <DayStepOpener beforeOpen={markRevealed} day={reveal.today} goalId={goalId} refresh={refresh}>
      {children}
    </DayStepOpener>
  );
}
