import { type PaceSource } from "./plan-state";

/** `ratio` is time taken over the estimate: 1.2 means 20% longer. */
export type PaceSample = { count: number; ratio: number };

export type Pace = { factor: number; source: PaceSource };

const MIN_LESSONS: Record<PaceSource, number> = { course: 20, own: 5, typical: 50 };

const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2.5;

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

function blendOwn({ own, prior }: { own: PaceSample; prior: number }): number {
  return (own.count * own.ratio + PRIOR_LESSONS * prior) / (own.count + PRIOR_LESSONS);
}

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
