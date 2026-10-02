const PITCH_CLASSES = 12;
const MS_PER_MINUTE = 60_000;

/**
 * How far a whole performance may sit from the beat and still count as the device's delay:
 * Bluetooth headphones add up to about 300 ms, and people anticipate a click a little. A larger
 * shift is the rhythm played on the wrong beats.
 */
const MAX_EARLY_SHIFT_MS = 80;
const MAX_LATE_SHIFT_MS = 300;

/**
 * Once the device's delay was measured (the learner tapped along with steady clicks once), only a
 * small steady drift is still excused, so a learner who drags behind the beat hears about it.
 */
const MAX_CALIBRATED_SHIFT_MS = 60;

/** The range a measured device delay can take: a little ahead of the click to half a second late. */
export const MIN_DEVICE_DELAY_MS = -100;
export const MAX_DEVICE_DELAY_MS = 500;

/** Note letters placed on the 12 semitones of an octave from C; "_" marks the black keys. */
const CHROMATIC_LETTERS = "C_D_EF_G_A_B";

export const CHORD_QUALITIES = [
  "augmented",
  "diminished",
  "dominant7",
  "major",
  "major7",
  "minor",
  "minor7",
] as const;

export type ChordQuality = (typeof CHORD_QUALITIES)[number];

/**
 * Intervals by their usual short names, one semitone apart: m2 is a minor second (1 semitone),
 * TT the tritone (6) and P8 the octave (12).
 */
export const INTERVAL_NAMES = [
  "m2",
  "M2",
  "m3",
  "M3",
  "P4",
  "TT",
  "P5",
  "m6",
  "M6",
  "m7",
  "M7",
  "P8",
] as const;

export type IntervalName = (typeof INTERVAL_NAMES)[number];

/** The notes above the root in each chord quality, as intervals. */
const CHORD_INTERVALS = {
  augmented: ["M3", "m6"],
  diminished: ["m3", "TT"],
  dominant7: ["M3", "P5", "m7"],
  major: ["M3", "P5"],
  major7: ["M3", "P5", "M7"],
  minor: ["m3", "P5"],
  minor7: ["m3", "P5", "m7"],
} as const satisfies Record<ChordQuality, readonly IntervalName[]>;

export function semitones(interval: IntervalName): number {
  return INTERVAL_NAMES.indexOf(interval) + 1;
}

/** A note like "C", "Eb" or "F#4". The octave is optional for pitch classes. */
export const NOTE_PATTERN = /^[A-G](?:#|b)?[0-8]?$/u;

/** The notes above a chord's root, as intervals from it, lowest first. */
export function chordIntervals(quality: ChordQuality): readonly IntervalName[] {
  return CHORD_INTERVALS[quality];
}

/** The note's pitch class, 0 for C up to 11 for B, or null when it isn't a note. */
export function pitchClass(note: string): number | null {
  if (!NOTE_PATTERN.test(note)) {
    return null;
  }

  const base = CHROMATIC_LETTERS.indexOf(note.charAt(0));
  const accidental = { "#": 1, b: -1 }[note.charAt(1)] ?? 0;

  return (base + accidental + PITCH_CLASSES) % PITCH_CLASSES;
}

function sortedUnique(values: readonly number[]): number[] {
  return [...new Set(values)].toSorted((a, b) => a - b);
}

export function notesPitchClasses(notes: readonly string[]): number[] | null {
  const classes = notes.map((note) => pitchClass(note));
  return classes.every((value) => value !== null) ? sortedUnique(classes) : null;
}

export function chordPitchClasses(root: string, quality: ChordQuality): number[] | null {
  const rootClass = pitchClass(root);

  if (rootClass === null) {
    return null;
  }

  const above = CHORD_INTERVALS[quality].map(
    (interval) => (rootClass + semitones(interval)) % PITCH_CLASSES,
  );

  return sortedUnique([rootClass, ...above]);
}

/** The grid steps marked "x" in a rhythm pattern, where a tap should land. */
export function rhythmHitSteps(pattern: string): number[] {
  return [...pattern.matchAll(/x/gu)].map((match) => match.index);
}

/** How long one step of a rhythm grid lasts, in milliseconds. */
export function rhythmStepMs({ stepsPerBeat, tempo }: { stepsPerBeat: number; tempo: number }) {
  return MS_PER_MINUTE / tempo / stepsPerBeat;
}

/** When each tap should land, in milliseconds from the first step of the first round. */
export function rhythmTapTimes(rhythm: {
  pattern: string;
  rounds: number;
  stepsPerBeat: number;
  tempo: number;
}): number[] {
  const stepMs = rhythmStepMs(rhythm);
  const hits = rhythmHitSteps(rhythm.pattern);

  return Array.from({ length: rhythm.rounds }, (_, round) =>
    hits.map((step) => (round * rhythm.pattern.length + step) * stepMs),
  ).flat();
}

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

/**
 * The steady delay of the device's audio in a performance: the median of each tap's distance
 * from its beat, capped so a rhythm moved onto other beats isn't excused as delay. With the
 * device's delay already measured and taken out, only a small drift is left to excuse.
 */
export function rhythmDelayShift(
  rawOffsetsMs: readonly number[],
  { calibrated = false }: { calibrated?: boolean } = {},
): number {
  const early = calibrated ? MAX_CALIBRATED_SHIFT_MS : MAX_EARLY_SHIFT_MS;
  const late = calibrated ? MAX_CALIBRATED_SHIFT_MS : MAX_LATE_SHIFT_MS;

  return Math.min(Math.max(median(rawOffsetsMs), -early), late);
}

/** A reading from fewer taps than this is a guess, so the learner is asked to tap along again. */
const MIN_CALIBRATION_TAPS = 4;

/** Each click's nearest tap within half an interval (a tap pairs with one click at most). */
function pairCalibrationTaps({
  clicksMs,
  intervalMs,
  tapsMs,
}: {
  clicksMs: readonly number[];
  intervalMs: number;
  tapsMs: readonly number[];
}): number[] {
  return clicksMs.flatMap((click) => {
    const nearest = tapsMs
      .map((tap) => tap - click)
      .filter((offset) => Math.abs(offset) <= intervalMs / 2)
      .toSorted((a, b) => Math.abs(a) - Math.abs(b))[0];

    return nearest === undefined ? [] : [nearest];
  });
}

/**
 * How late a device plays sound, measured once by tapping along with steady clicks: the median
 * distance from each click to its tap, in milliseconds (positive when the taps come after the
 * clicks' scheduled time, as with Bluetooth headphones). The clicks must be more than a second
 * apart for half a second of delay to read right. Null when too few taps matched a click, or the
 * reading is too far off to be a delay.
 */
export function estimateDeviceDelay({
  clicksMs,
  intervalMs,
  tapsMs,
}: {
  clicksMs: readonly number[];
  intervalMs: number;
  tapsMs: readonly number[];
}): number | null {
  const offsets = pairCalibrationTaps({ clicksMs, intervalMs, tapsMs });

  if (offsets.length < MIN_CALIBRATION_TAPS) {
    return null;
  }

  const delay = Math.round(median(offsets));

  return delay < MIN_DEVICE_DELAY_MS || delay > MAX_DEVICE_DELAY_MS ? null : delay;
}

/**
 * How early (negative) or late each tap was, in milliseconds, once the device's steady delay is
 * taken out: the delay measured on the device when there is one, then the performance's own
 * steady shift. Taps pair with beats in time order. Null when the counts differ, since then taps
 * can't pair.
 */
export function rhythmTapOffsets({
  deviceDelayMs,
  expectedMs,
  tapsMs,
}: {
  deviceDelayMs?: number;
  expectedMs: readonly number[];
  tapsMs: readonly number[];
}): number[] | null {
  if (tapsMs.length !== expectedMs.length || tapsMs.length === 0) {
    return null;
  }

  const taps = tapsMs.toSorted((a, b) => a - b);
  const raw = taps.map((tap, index) => tap - (deviceDelayMs ?? 0) - (expectedMs[index] ?? 0));
  const shift = rhythmDelayShift(raw, { calibrated: deviceDelayMs !== undefined });

  return raw.map((offset) => offset - shift);
}
