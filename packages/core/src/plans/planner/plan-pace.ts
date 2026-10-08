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

/**
 * How many lessons the pace learners had before counts as, against the learner's own: their own
 * pace takes over as they finish more, so a few quick (or slow) lessons nudge every estimate
 * instead of halving or doubling it.
 */
const PRIOR_LESSONS = 20;

function isTrusted({ sample, source }: { sample: PaceSample | null; source: PaceSource }) {
  return sample !== null && sample.count >= MIN_LESSONS[source] && sample.ratio > 0;
}

function findTrusted(
  samples: readonly [PaceSource, PaceSample | null][],
): [PaceSource, PaceSample] | null {
  const found = samples.find(([source, sample]) => isTrusted({ sample, source }));
  return found?.[1] ? [found[0], found[1]] : null;
}

/** The learner's own pace, weighed against what others' pace said by how many lessons it rests on. */
function blendOwn({ own, prior }: { own: PaceSample; prior: number }): number {
  return (own.count * own.ratio + PRIOR_LESSONS * prior) / (own.count + PRIOR_LESSONS);
}

/**
 * Picks the pace estimates use: the learner's own once they finished enough lessons (blended with
 * what others' pace said until it rests on many), then other learners' pace on the goal's lessons,
 * then the average across all lessons, and the lessons' own estimates when there's no data yet.
 */
export function choosePace({ course, own, typical }: Record<PaceSource, PaceSample | null>): Pace {
  const others = findTrusted([
    ["course", course],
    ["typical", typical],
  ]);

  const prior = others?.[1].ratio ?? 1;
  const ownTrusted = own && isTrusted({ sample: own, source: "own" }) ? own : null;

  const [source, ratio]: [PaceSource, number] = ownTrusted
    ? ["own", blendOwn({ own: ownTrusted, prior })]
    : [others?.[0] ?? "typical", prior];

  const factor = Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, ratio));

  return { factor: Math.round(factor * 100) / 100, source };
}

/** "Your plan got more precise": the pace now comes from a closer source than before. */
export function isMorePrecise({ next, previous }: { next: Pace; previous: Pace | null }): boolean {
  return previous !== null && PRECISION[next.source] > PRECISION[previous.source];
}
