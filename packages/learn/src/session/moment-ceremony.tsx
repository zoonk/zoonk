"use client";

import { useEffect, useRef, useState } from "react";
import { STEP_TITLE_SLOT } from "../_components/step-card";
import { focusStepTitle } from "../_components/steps";
import { CeremonyClosingContext } from "../ceremonies/ceremony-closing";
import { type CeremonyMilestone } from "../ceremonies/use-ceremony-copy";

export type MomentCeremony = (milestone: CeremonyMilestone, onClose: () => void) => React.ReactNode;

/** The title takes focus once a ceremony before it closes; it adds `outline-none` itself. */
export const MOMENT_TITLE_PROPS = { "data-slot": STEP_TITLE_SLOT, tabIndex: -1 } as const;

export function getCeremonyMoment({
  milestone,
  render,
}: {
  milestone: CeremonyMilestone | null;
  render?: MomentCeremony;
}) {
  return milestone && render ? (close: () => void) => render(milestone, close) : undefined;
}

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
