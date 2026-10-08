import {
  type ChordQuality,
  type IntervalName,
  semitones,
} from "@zoonk/core/library/activities/music";
import { type GuitarVoicing, findGuitarVoicing, stringNoteMidi } from "../_utils/guitar-voicing";
import { chordMidis, noteToMidi } from "../_utils/music-notes";
import { type SoundEvent, oneByOne, together } from "../_utils/sound-events";
import { type ActivityRendererProps } from "../activity-renderer";

const OCTAVE = 12;
const PITCH_C = 0;
const PITCH_E = 4;
const PITCH_F = 5;
const PITCH_B = 11;
const RANGE_STARTS = new Set([PITCH_C, PITCH_F]);
const RANGE_ENDS = new Set([PITCH_E, PITCH_B]);

type Chord = { quality: ChordQuality; root: string };
type EarTrainerFields = ActivityRendererProps<"earTrainer">["content"]["fields"];

const INTERVAL_GAP = 0.9;
const ARPEGGIO_START = 1.6;
const ARPEGGIO_GAP = 0.4;
const CHORD_SECONDS = 1.7;
const STRUM_GAP = 0.03;

/** A choice in any mode: what it names, the song that helps remember it and how it sounds. */
export type EarOption =
  | { id: string; interval: IntervalName; kind: "interval"; song: string | null }
  | { id: string; kind: "quality"; quality: ChordQuality; song: string | null }
  | { chord: Chord; id: string; kind: "chord"; song: string | null };

/** The two notes of an interval from its root, low then high. */
function intervalNotes(root: string, interval: IntervalName): [number, number] {
  const base = noteToMidi(root) ?? 0;
  return [base, base + semitones(interval)];
}

/** How a guitarist would finger the chord, root in the bass. */
export function chordVoicing(chord: Chord): GuitarVoicing | null {
  const pitches = [...new Set(chordMidis(chord.root, chord.quality).map((midi) => midi % OCTAVE))];
  const bass = (noteToMidi(chord.root) ?? 0) % OCTAVE;
  return findGuitarVoicing({ bass, pitchClasses: pitches });
}

/** A chord as a guitarist would strum it (low to high), or voiced up from its root. */
function strummedChord(chord: Chord): number[] {
  const voicing = chordVoicing(chord);

  return voicing
    ? voicing.flatMap((fret, index) => (fret === null ? [] : [stringNoteMidi(index, fret)]))
    : chordMidis(chord.root, chord.quality);
}

function stepUntil(midi: number, step: number, stops: ReadonlySet<number>): number {
  return stops.has(((midi % OCTAVE) + OCTAVE) % OCTAVE)
    ? midi
    : stepUntil(midi + step, step, stops);
}

/**
 * The stretch of keyboard that shows these notes without crowding: from the C or F at or below
 * the lowest note to the E or B at or above the highest, so the keys start and end on a white
 * key the way a real keyboard does.
 */
export function keyboardRange(midis: readonly number[]): { from: number; to: number } {
  const lowest = Math.min(...midis);
  const highest = Math.max(...midis);

  return { from: stepUntil(lowest, -1, RANGE_STARTS), to: stepUntil(highest, 1, RANGE_ENDS) };
}

/** The choices of any mode in one shape, so the renderer draws and plays them the same way. */
export function earOptions(fields: EarTrainerFields): EarOption[] {
  if (fields.mode === "interval") {
    return fields.options.map((option) => ({
      id: option.id,
      interval: option.id,
      kind: "interval",
      song: option.song ?? null,
    }));
  }

  if (fields.mode === "chord") {
    return fields.options.map((option) => ({
      id: option.id,
      kind: "quality",
      quality: option.id,
      song: option.song ?? null,
    }));
  }

  return fields.options.map((option) => ({
    chord: { quality: option.quality, root: option.root },
    id: option.id,
    kind: "chord",
    song: null,
  }));
}

/** A chord struck, then its notes one by one from the root. */
function chordSound(chord: Chord): SoundEvent[] {
  const midis = chordMidis(chord.root, chord.quality);
  return [...together(midis), ...oneByOne(midis, ARPEGGIO_GAP, ARPEGGIO_START)];
}

/** Chords strummed one after another, `CHORD_SECONDS` apart. */
function progressionSound(chords: readonly Chord[]): SoundEvent[] {
  return chords.flatMap((chord, index) =>
    together(strummedChord(chord), { at: index * CHORD_SECONDS, gap: STRUM_GAP }),
  );
}

/** When each chord of a progression starts, in seconds, to follow along on screen. */
export function progressionStarts(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index * CHORD_SECONDS);
}

/** What the learner hears: the interval, the chord or the progression. */
export function earTrainerSound(fields: EarTrainerFields): SoundEvent[] {
  if (fields.mode === "interval") {
    return oneByOne(intervalNotes(fields.root, fields.played), INTERVAL_GAP);
  }

  if (fields.mode === "chord") {
    return chordSound({ quality: fields.played, root: fields.root });
  }

  return progressionSound(fields.chords);
}

/** How a choice sounds from the same root, to compare a wrong pick with what played. */
export function optionSound(fields: EarTrainerFields, option: EarOption): SoundEvent[] {
  if (option.kind === "interval" && fields.mode === "interval") {
    return oneByOne(intervalNotes(fields.root, option.interval), INTERVAL_GAP);
  }

  if (option.kind === "quality" && fields.mode === "chord") {
    return chordSound({ quality: option.quality, root: fields.root });
  }

  return option.kind === "chord" ? together(strummedChord(option.chord), { gap: STRUM_GAP }) : [];
}

/** The notes that played, to mark on the keys after the check (a progression's hidden chord). */
export function playedMidis(fields: EarTrainerFields): number[] {
  if (fields.mode === "interval") {
    return intervalNotes(fields.root, fields.played);
  }

  if (fields.mode === "chord") {
    return chordMidis(fields.root, fields.played);
  }

  const hidden = fields.chords[fields.hidden];
  return hidden ? chordMidis(hidden.root, hidden.quality) : [];
}
