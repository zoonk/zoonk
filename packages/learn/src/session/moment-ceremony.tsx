"use client";

import { useEffect, useRef, useState } from "react";
import { STEP_TITLE_SLOT } from "../_components/step-card";
import { focusStepTitle } from "../_components/steps";
import { CeremonyClosingContext } from "../ceremonies/ceremony-closing";
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
 * What the ceremony leaves behind: the moment, drawn under the ceremony as it fades out, whose
 * title (`MOMENT_TITLE_PROPS`) takes the focus the ceremony's dialog took with it once it's gone
 * (`closed`), so a screen reader reads on from there.
 */
function AfterCeremony({ children, closed }: { children: React.ReactNode; closed: boolean }) {
  const moment = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (closed) {
      focusStepTitle(moment.current);
    }
  }, [closed]);

  return (
    <div className="contents" ref={moment}>
      {children}
    </div>
  );
}

/**
 * A block's moment after its milestone's ceremony: the ceremony comes first, on its own, and the
 * moment (its missions stamping in, its bars filling) is drawn under it once it begins to close,
 * so nothing plays hidden behind it and the ceremony fades out over the moment, never over an
 * empty screen.
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
  const [stage, setStage] = useState<"closed" | "closing" | "open">("open");

  if (!render || !milestone) {
    return children;
  }

  return (
    <>
      {stage !== "open" && <AfterCeremony closed={stage === "closed"}>{children}</AfterCeremony>}
      {stage !== "closed" && (
        <CeremonyClosingContext value={() => setStage("closing")}>
          {render(milestone, () => setStage("closed"))}
        </CeremonyClosingContext>
      )}
    </>
  );
}
