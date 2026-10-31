import { rhythmDelayShift } from "@zoonk/core/library/activities/music";

const MATCH_WINDOW_SHARE = 0.5;

type TapStatus = "early" | "late" | "missed" | "onTime";

export type HitResult = { offsetMs: number | null; status: TapStatus };

function statusOf(offsetMs: number, toleranceMs: number): TapStatus {
  if (Math.abs(offsetMs) <= toleranceMs) {
    return "onTime";
  }

  return offsetMs < 0 ? "early" : "late";
}

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

export function rhythmResults({
  beatMs,
  deviceDelayMs,
  expectedMs,
  tapsMs,
  toleranceMs,
}: {
  beatMs: number;
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
