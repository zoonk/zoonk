"use client";

import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { createContext, use, useState } from "react";

/** What the server drew a page's dates with: the learner's zone and the moment it rendered. */
export type LearnerClockSnapshot = { now: number; timeZone: string };

export type LearnerClock = { now: Date; timeZone: string };

const LearnerClockContext = createContext<Promise<LearnerClockSnapshot> | null>(null);

/** `clock` is the server's snapshot, still pending while the page's shell renders. */
export function LearnerClockProvider({
  children,
  clock,
}: {
  children: React.ReactNode;
  clock: Promise<LearnerClockSnapshot>;
}) {
  return <LearnerClockContext value={clock}>{children}</LearnerClockContext>;
}

function readClock({
  mounted,
  snapshot,
}: {
  mounted: boolean;
  snapshot: LearnerClockSnapshot | null;
}): LearnerClock {
  if (snapshot) {
    return { now: new Date(snapshot.now), timeZone: snapshot.timeZone };
  }

  return { now: new Date(), timeZone: mounted ? getLocalTimeZone() : "UTC" };
}

/**
 * The zone and moment a component draws its dates with, kept until it unmounts so no date on
 * screen changes after load. A component the server rendered hydrates with the server's snapshot;
 * one first mounted in the browser reads the device. Without a provider, the server and
 * hydration draw in UTC.
 */
export function useLearnerClock(): LearnerClock {
  const clock = use(LearnerClockContext);
  const mounted = useIsMounted();
  const snapshot = clock && !mounted ? use(clock) : null;
  // oxlint-disable-next-line react/hook-use-state -- Read once and never updated, so there is no setter.
  const [drawn] = useState(() => readClock({ mounted, snapshot }));

  return drawn;
}
