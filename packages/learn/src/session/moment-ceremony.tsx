"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { STEP_TITLE_SLOT } from "../_components/step-card";
import { focusStepTitle } from "../_components/steps";
import { CeremonyClosingContext } from "../ceremonies/ceremony-closing";
import { type CeremonyMilestone } from "../ceremonies/use-ceremony-copy";

/** What a result shows full screen before itself: its new certificates, then its one milestone. */
export type EarnedMoments = {
  ceremony: CeremonyMilestone | null;
  certificates: CertificateFacts[];
};

export type MomentCeremony = (moments: EarnedMoments, onClose: () => void) => React.ReactNode;

/** The title takes focus once a ceremony before it closes; it adds `outline-none` itself. */
export const MOMENT_TITLE_PROPS = { "data-slot": STEP_TITLE_SLOT, tabIndex: -1 } as const;

function hasMoments(moments: EarnedMoments | null): moments is EarnedMoments {
  return Boolean(moments && (moments.ceremony || moments.certificates.length > 0));
}

export function getCeremonyMoment({
  moments,
  render,
}: {
  moments: EarnedMoments | null;
  render?: MomentCeremony;
}) {
  return hasMoments(moments) && render ? (close: () => void) => render(moments, close) : undefined;
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

/** Hidden this long means the router kept the page for Back; development's double effect run is instant. */
const SHOWN_AGAIN_MS = 100;

/**
 * The router keeps a page for Back and Forward, but an open dialog stays hidden when it shows the
 * page again (`useHideElement`), so a ceremony left open would hide the result for good.
 */
function useClosedOnReturn(onReturn: () => void) {
  const hiddenAt = useRef<number | null>(null);
  const close = useEffectEvent(onReturn);

  useLayoutEffect(() => {
    if (hiddenAt.current !== null && performance.now() - hiddenAt.current > SHOWN_AGAIN_MS) {
      close();
    }

    return () => {
      hiddenAt.current = performance.now();
    };
  }, []);
}

export function MomentAfterCeremony({
  children,
  moments,
  render,
}: {
  children: React.ReactNode;
  moments: EarnedMoments | null;
  render?: MomentCeremony;
}) {
  const [stage, setStage] = useState<"closed" | "closing" | "open">("open");

  useClosedOnReturn(() => setStage("closed"));

  if (!render || !hasMoments(moments)) {
    return children;
  }

  return (
    <>
      {stage !== "open" && <AfterCeremony closed={stage === "closed"}>{children}</AfterCeremony>}
      {stage !== "closed" && (
        <CeremonyClosingContext value={() => setStage("closing")}>
          {render(moments, () => setStage("closed"))}
        </CeremonyClosingContext>
      )}
    </>
  );
}
