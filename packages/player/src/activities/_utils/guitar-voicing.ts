import { noteToMidi } from "./music-notes";

/*
 * Where notes sit on a guitar in standard tuning, and a playable shape for a set of pitch
 * classes: the kind of chord diagram a guitarist would pick, near the nut when possible.
 */

const OCTAVE = 12;

/** Open strings from the low E to the high E, as MIDI numbers. */
export const GUITAR_TUNING: readonly number[] = ["E2", "A2", "D3", "G3", "B3", "E4"].map(
  (note) => noteToMidi(note) ?? 0,
);

/** Frets a hand spans without moving. */
const HAND_SPAN = 4;
const MAX_FINGERS = 4;
const HIGHEST_POSITION = 10;

/** One fret per string, low E first; null is a string that isn't played. */
export type GuitarVoicing = readonly (number | null)[];

export function stringNoteMidi(stringIndex: number, fret: number): number {
  return (GUITAR_TUNING[stringIndex] ?? 0) + fret;
}

function stringPitch(stringIndex: number, fret: number): number {
  return stringNoteMidi(stringIndex, fret) % OCTAVE;
}

/** Fretted notes need fingers; the lowest fret can be barred when nothing open sits under it. */
function fingersNeeded(voicing: GuitarVoicing): number {
  const fretted = voicing.flatMap((fret, index) => (fret ? [{ fret, index }] : []));

  if (fretted.length === 0) {
    return 0;
  }

  const lowest = Math.min(...fretted.map((note) => note.fret));
  const barred = fretted.filter((note) => note.fret === lowest);
  const first = barred[0]?.index ?? 0;
  const last = barred.at(-1)?.index ?? 0;
  const openUnderBarre = voicing.slice(first, last + 1).some((fret) => fret === 0);
  const canBarre = barred.length > 1 && !openUnderBarre;

  return canBarre ? fretted.length - barred.length + 1 : fretted.length;
}

/** Strings that sound must be next to each other, so a strum reaches them all. */
function isContiguous(voicing: GuitarVoicing): boolean {
  const played = voicing.flatMap((fret, index) => (fret === null ? [] : [index]));
  const first = played[0] ?? 0;
  const last = played.at(-1) ?? 0;

  return played.length === last - first + 1;
}

function isPlayable({
  bass,
  pitchClasses,
  voicing,
}: {
  bass: number;
  pitchClasses: readonly number[];
  voicing: GuitarVoicing;
}): boolean {
  const sounding = voicing.flatMap((fret, index) =>
    fret === null ? [] : [stringPitch(index, fret)],
  );

  return (
    sounding[0] === bass &&
    pitchClasses.every((pitch) => sounding.includes(pitch)) &&
    isContiguous(voicing) &&
    fingersNeeded(voicing) <= MAX_FINGERS
  );
}

/**
 * Lower is better: full and near the nut together (each string played is worth a fret of
 * reach), then nearer the nut, then easier to finger.
 */
function voicingCost(voicing: GuitarVoicing): number[] {
  const frets = voicing.filter((fret) => fret !== null);
  const highest = Math.max(0, ...frets);

  return [
    highest - frets.length,
    highest,
    fingersNeeded(voicing),
    frets.reduce((sum, fret) => sum + fret, 0),
  ];
}

function isCheaper(first: readonly number[], second: readonly number[]): boolean {
  const index = first.findIndex((value, position) => value !== second[position]);
  return index !== -1 && (first[index] ?? 0) < (second[index] ?? 0);
}

/** Every way to fill the strings from the given options, one choice per string. */
function combinations(options: readonly (readonly (number | null)[])[]): GuitarVoicing[] {
  return options.reduce<GuitarVoicing[]>(
    (partials, choices) => partials.flatMap((partial) => choices.map((fret) => [...partial, fret])),
    [[]],
  );
}

function voicingsAt(position: number, pitchClasses: readonly number[]): GuitarVoicing[] {
  const frets = [0, ...Array.from({ length: HAND_SPAN }, (_, offset) => position + offset)];

  const options = GUITAR_TUNING.map((_, stringIndex) => [
    null,
    ...[...new Set(frets)].filter((fret) => pitchClasses.includes(stringPitch(stringIndex, fret))),
  ]);

  return combinations(options);
}

/**
 * A playable shape for these pitch classes with `bass` as the lowest note (the chord's root, or
 * the lowest key pressed), or null when one hand can't reach them all.
 */
export function findGuitarVoicing({
  bass,
  pitchClasses,
}: {
  bass: number;
  pitchClasses: readonly number[];
}): GuitarVoicing | null {
  if (pitchClasses.length === 0 || pitchClasses.length > GUITAR_TUNING.length) {
    return null;
  }

  const candidates = Array.from({ length: HIGHEST_POSITION }, (_, index) => index + 1)
    .flatMap((position) => voicingsAt(position, pitchClasses))
    .filter((voicing) => isPlayable({ bass, pitchClasses, voicing }));

  return candidates.reduce<GuitarVoicing | null>(
    (best, voicing) =>
      best === null || isCheaper(voicingCost(voicing), voicingCost(best)) ? voicing : best,
    null,
  );
}
