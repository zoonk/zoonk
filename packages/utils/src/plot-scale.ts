export type NumericDomain = readonly [min: number, max: number];

export type LinearScale = {
  domain: NumericDomain;
  toValue: (position: number) => number;
  toPixel: (value: number) => number;
  range: NumericDomain;
};

/** A flat domain maps everything to the middle of the range. */
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

function niceStep(span: number, count: number): number {
  if (span <= 0 || count <= 0) {
    return 1;
  }

  const rough = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const nice = NICE_STEPS.find((step) => step * magnitude >= rough) ?? NICE_STEPS.at(-1) ?? 1;

  return nice * magnitude;
}

function cleanFloat(value: number): number {
  return Number(value.toPrecision(12));
}

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
 * Starts at zero by default so bars and areas aren't exaggerated by a cropped axis; line charts of
 * data far from zero pass `includeZero: false`.
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
