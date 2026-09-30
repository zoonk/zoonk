import { type PaceSource } from "./plan-state";

/** How long learners took against the lessons' estimates: 1.2 means 20% longer. */
export type PaceSample = { count: number; ratio: number };

export type Pace = { factor: number; source: PaceSource };

/** Enough lessons for each source to be trusted over the next one. */
const MIN_LESSONS: Record<PaceSource, number> = { course: 20, own: 5, typical: 50 };

/** Estimates never shrink below half or grow past two and a half times what lessons expect. */
const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2.5;

const PRECISION: Record<PaceSource, number> = { course: 1, own: 2, typical: 0 };

function isTrusted({ sample, source }: { sample: PaceSample | null; source: PaceSource }) {
  return sample !== null && sample.count >= MIN_LESSONS[source] && sample.ratio > 0;
}

/**
 * Picks the pace estimates use: the learner's own once they finished enough lessons, then other
 * learners' pace on the goal's lessons, then the average across all lessons, and the lessons' own
 * estimates when there's no data yet.
 */
export function choosePace({ course, own, typical }: Record<PaceSource, PaceSample | null>): Pace {
  const samples: [PaceSource, PaceSample | null][] = [
    ["own", own],
    ["course", course],
    ["typical", typical],
  ];

  const [source, sample] = samples.find(([name, value]) =>
    isTrusted({ sample: value, source: name }),
  ) ?? ["typical", null];

  const factor = sample ? Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, sample.ratio)) : 1;

  return { factor: Math.round(factor * 100) / 100, source };
}

/** "Your plan got more precise": the pace now comes from a closer source than before. */
export function isMorePrecise({ next, previous }: { next: Pace; previous: Pace | null }): boolean {
  return previous !== null && PRECISION[next.source] > PRECISION[previous.source];
}
