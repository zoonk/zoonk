"use client";

import { useEffect, useRef, useState } from "react";
import { STEP_TITLE_SLOT } from "../_components/step-card";
import { focusStepTitle } from "../_components/steps";
import { type CeremonyMilestone } from "../ceremonies/use-ceremony-copy";

/** The host's full-screen ceremony for a milestone the block earned, closed with `onClose`. */
export type MomentCeremony = (milestone: CeremonyMilestone, onClose: () => void) => React.ReactNode;

/**
 * Makes a result's title the one that takes the focus once the ceremony before it closes, as a
 * step's title is (`StepTitle`); the title adds `outline-none`.
 */
export const MOMENT_TITLE_PROPS = { "data-slot": STEP_TITLE_SLOT, tabIndex: -1 } as const;

/**
 * A milestone's ceremony as the full-screen moment a result's first step opens with (`Steps`), when
 * the host draws ceremonies.
 */
export function getCeremonyMoment({
  milestone,
  render,
}: {
  milestone: CeremonyMilestone | null;
  render?: MomentCeremony;
}) {
  return milestone && render ? (close: () => void) => render(milestone, close) : undefined;
}

/**
 * What the ceremony leaves behind once it closes: the moment, whose title (`MOMENT_TITLE_PROPS`)
 * takes the focus the ceremony's dialog took with it, so a screen reader reads on from there.
 */
function AfterCeremony({ children }: { children: React.ReactNode }) {
  const moment = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusStepTitle(moment.current);
  }, []);

  return (
    <div className="contents" ref={moment}>
      {children}
    </div>
  );
}

/**
 * A block's moment after its milestone's ceremony: the ceremony comes first, on its own, and the
 * moment (its missions stamping in, its bars filling) shows once it closes, so nothing plays
 * hidden behind it.
 */
export function MomentAfterCeremony({
  children,
  milestone,
  render,
}: {
  children: React.ReactNode;
  milestone: CeremonyMilestone | null;
  render?: MomentCeremony;
}) {
  const [closed, setClosed] = useState(false);

  if (!render || !milestone) {
    return children;
  }

  if (closed) {
    return <AfterCeremony>{children}</AfterCeremony>;
  }

  return render(milestone, () => setClosed(true));
}
