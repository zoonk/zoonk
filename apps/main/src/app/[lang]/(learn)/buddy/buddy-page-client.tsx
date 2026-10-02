"use client";

import { saveBuddyAction } from "@/app/[lang]/(settings)/settings/appearance/actions";
import { BuddyScreen, type BuddyScreenHrefs, type BuddyStatusView } from "@zoonk/learn/buddy";

const HREFS: BuddyScreenHrefs = {
  appearance: "/settings/appearance",
  logbook: "/logbook",
  preparation: "/progress",
};

/** Wearing earned glasses saves the whole buddy, as Appearance does, so both stay in step. */
export function BuddyPageClient({ status }: { status: BuddyStatusView }) {
  const { buddy } = status;

  return (
    <BuddyScreen
      hrefs={HREFS}
      onWearGlasses={(glasses) =>
        buddy
          ? saveBuddyAction({ glasses, kind: buddy.kind, name: buddy.name })
          : Promise.resolve(false)
      }
      status={status}
    />
  );
}
