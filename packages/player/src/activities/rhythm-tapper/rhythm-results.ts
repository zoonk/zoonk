import { rhythmDelayShift } from "@zoonk/core/library/activities/music";

/** A tap more than half a beat from every hit isn't aimed at any of them. */
const MATCH_WINDOW_SHARE = 0.5;

type TapStatus = "early" | "late" | "missed" | "onTime";

/** How one hit of the rhythm went: when the tap came, relative to the beat, once delay is out. */
export type HitResult = { offsetMs: number | null; status: TapStatus };

function statusOf(offsetMs: number, toleranceMs: number): TapStatus {
  if (Math.abs(offsetMs) <= toleranceMs) {
    return "onTime";
  }

  return offsetMs < 0 ? "early" : "late";
}

/** Each hit's nearest tap within reach, taken in time order so a tap answers one hit only. */
function pairTaps({
  beatMs,
  expectedMs,
  tapsMs,
}: {
  beatMs: number;
  expectedMs: readonly number[];
  tapsMs: readonly number[];
}): (number | null)[] {
  const window = beatMs * MATCH_WINDOW_SHARE;

  return expectedMs.reduce<{ pairs: (number | null)[]; used: Set<number> }>(
    ({ pairs, used }, time) => {
      const nearest = tapsMs
        .map((tap, index) => ({ distance: Math.abs(tap - time), index, tap }))
        .filter((item) => !used.has(item.index) && item.distance <= window)
        .toSorted((a, b) => a.distance - b.distance)[0];

      return nearest
        ? { pairs: [...pairs, nearest.tap], used: new Set([...used, nearest.index]) }
        : { pairs: [...pairs, null], used };
    },
    { pairs: [], used: new Set() },
  ).pairs;
}

/**
 * How each hit of the rhythm went, for showing the learner (grading stays in core): the device's
 * measured delay comes out first, taps pair with the nearest hit, the steady delay left comes out
 * the same way core takes it out, and leftover taps count as extra.
 */
export function rhythmResults({
  beatMs,
  deviceDelayMs,
  expectedMs,
  tapsMs,
  toleranceMs,
}: {
  beatMs: number;
  /** The device's measured sound delay, when the learner tapped along once to measure it. */
  deviceDelayMs?: number;
  expectedMs: readonly number[];
  tapsMs: readonly number[];
  toleranceMs: number;
}): { extraTaps: number; hits: HitResult[] } {
  const heardTaps = tapsMs.map((tap) => tap - (deviceDelayMs ?? 0));
  const pairs = pairTaps({ beatMs, expectedMs, tapsMs: heardTaps });
  const raw = pairs.flatMap((tap, index) => (tap === null ? [] : [tap - (expectedMs[index] ?? 0)]));
  const calibrated = deviceDelayMs !== undefined;
  const shift = raw.length > 0 ? rhythmDelayShift(raw, { calibrated }) : 0;

  const hits = pairs.map((tap, index): HitResult => {
    if (tap === null) {
      return { offsetMs: null, status: "missed" };
    }

    const offsetMs = Math.round(tap - (expectedMs[index] ?? 0) - shift);
    return { offsetMs, status: statusOf(offsetMs, toleranceMs) };
  });

  return { extraTaps: tapsMs.length - raw.length, hits };
}

/** The hit that went furthest off, to name in the feedback, or null when all were on time. */
export function worstHit(hits: readonly HitResult[]): { hit: HitResult; index: number } | null {
  const off = hits
    .map((hit, index) => ({ hit, index }))
    .filter(({ hit }) => hit.status !== "onTime");

  const missed = off.find(({ hit }) => hit.status === "missed");

  return (
    missed ??
    off.toSorted((a, b) => Math.abs(b.hit.offsetMs ?? 0) - Math.abs(a.hit.offsetMs ?? 0))[0] ??
    null
  );
}
