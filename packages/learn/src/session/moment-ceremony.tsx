"use client";

import { useState } from "react";
import { type CeremonyMilestone } from "../ceremonies/use-ceremony-copy";

/** The host's full-screen ceremony for a milestone the block earned, closed with `onClose`. */
export type MomentCeremony = (milestone: CeremonyMilestone, onClose: () => void) => React.ReactNode;

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

  if (!render || !milestone || closed) {
    return children;
  }

  return render(milestone, () => setClosed(true));
}
