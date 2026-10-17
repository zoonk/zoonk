export type NumericDomain = readonly [min: number, max: number];

export type LinearScale = {
  domain: NumericDomain;
  toValue: (position: number) => number;
  toPixel: (value: number) => number;
  range: NumericDomain;
};

/** Maps a data range onto pixels. A flat domain maps everything to the middle of the range. */
export function createLinearScale({
  domain,
  range,
}: {
  domain: NumericDomain;
  range: NumericDomain;
}): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;

  return {
    domain,
    range,
    toPixel: (value) => (span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0)),
    toValue: (position) => (r1 === r0 ? d0 : d0 + ((position - r0) / (r1 - r0)) * span),
  };
}

/* oxlint-disable-next-line no-magic-numbers -- These are the round steps themselves. */
const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;
const DEFAULT_TICK_COUNT = 4;

/** A round step (1, 2, 2.5 or 5 times a power of ten) that splits the range into about `count`. */
function niceStep(span: number, count: number): number {
  if (span <= 0 || count <= 0) {
    return 1;
  }

  const rough = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const nice = NICE_STEPS.find((step) => step * magnitude >= rough) ?? NICE_STEPS.at(-1) ?? 1;

  return nice * magnitude;
}

/** Rounds away float noise such as 0.30000000000000004 so tick labels stay clean. */
function cleanFloat(value: number): number {
  return Number(value.toPrecision(12));
}

/** Round tick values inside the domain, both ends snapped outward to the step. */
export function niceTicks(domain: NumericDomain, count = DEFAULT_TICK_COUNT): number[] {
  const [min, max] = domain;
  const step = niceStep(max - min, count);
  const first = Math.ceil(cleanFloat(min / step)) * step;
  const total = Math.floor(cleanFloat((max - first) / step));

  return Array.from({ length: Math.max(total + 1, 0) }, (_, index) =>
    cleanFloat(first + index * step),
  );
}

/**
 * A domain that holds every value with round ends. By default it starts at zero when every value
 * sits on one side of it, so bars and areas aren't exaggerated by a cropped axis; line charts of
 * data far from zero (like CO₂ in ppm) pass `includeZero: false` to show the trend.
 */
export function niceDomain(
  values: readonly number[],
  {
    count = DEFAULT_TICK_COUNT,
    includeZero = true,
  }: { count?: number; includeZero?: boolean } = {},
): NumericDomain {
  const finite = values.filter((value) => Number.isFinite(value));
  const anchors = includeZero ? [0] : [];
  const low = Math.min(...anchors, ...finite);
  const high = Math.max(...anchors, ...finite);

  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return [0, 1];
  }

  if (low === high) {
    return [low, low + 1];
  }

  const step = niceStep(high - low, count);

  return [
    cleanFloat(Math.floor(cleanFloat(low / step)) * step),
    cleanFloat(Math.ceil(cleanFloat(high / step)) * step),
  ];
}
