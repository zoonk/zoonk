"use client";

import { useState } from "react";
import { type CeremonyMilestone } from "../ceremonies/use-ceremony-copy";

/** The host's full-screen ceremony for a milestone the block earned, closed with `onClose`. */
export type MomentCeremony = (milestone: CeremonyMilestone, onClose: () => void) => React.ReactNode;

/** The host's ceremony for the block's milestone, once: over the moment until it's closed. */
export function MomentCeremonyOnce({
  milestone,
  render,
}: {
  milestone: CeremonyMilestone | null;
  render?: MomentCeremony;
}) {
  const [closed, setClosed] = useState(false);

  if (!render || !milestone || closed) {
    return null;
  }

  return render(milestone, () => setClosed(true));
}
