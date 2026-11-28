import { getLearnerClock } from "@/lib/learner/learner-clock";
import { LearnerClockProvider } from "@zoonk/learn/learner-clock";

/**
 * Only around a learner's own pages: a fully static route (the catalog, home, pricing) can't be
 * handed a request's snapshot, and draws no learner dates.
 */
export function LearnerClock({ children }: { children: React.ReactNode }) {
  return <LearnerClockProvider clock={getLearnerClock()}>{children}</LearnerClockProvider>;
}
