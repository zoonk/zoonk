import {
  CHORD_QUALITIES,
  type ChordQuality,
  type IntervalName,
  chordIntervals,
  chordPitchClasses,
  pitchClass,
  semitones,
} from "@zoonk/core/library/activities/music";

const OCTAVE = 12;
const LETTERS = "CDEFGAB";
const MIDI_OCTAVE_OFFSET = 1;
const DEFAULT_OCTAVE = 4;
const MAX_ACCIDENTAL = 2;

/** How the keys are named in an answer: sharps, which core's pitch-class grading accepts. */
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/** Chord roots the way musicians usually write them: Eb and Bb, but F#. */
const ROOT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

/** Letters above the root for each interval: a third is two letters up, a fifth four. */
const INTERVAL_LETTER_STEPS: Record<IntervalName, number> = {
  M2: 1,
  M3: 2,
  M6: 5,
  M7: 6,
  P4: 3,
  P5: 4,
  P8: 7,
  TT: 3,
  m2: 1,
  m3: 2,
  m6: 5,
  m7: 6,
};

/** Chords stack thirds, so each tone above the root is two more letters up (C, E, G, B). */
const LETTERS_PER_THIRD = 2;

const ACCIDENTALS: Record<number, string> = { [-2]: "bb", [-1]: "b", 0: "", 1: "#", 2: "##" };

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}

/** The note's name with the octave, like "C#4", from its MIDI number (60 is middle C). */
export function midiToNote(midi: number): string {
  const name = SHARP_NAMES[mod(midi, OCTAVE)] ?? "C";
  return `${name}${Math.floor(midi / OCTAVE) - MIDI_OCTAVE_OFFSET}`;
}

/** A note's MIDI number; notes written without an octave sit in `octave`. */
export function noteToMidi(note: string, octave = DEFAULT_OCTAVE): number | null {
  const pitch = pitchClass(note);
  const written = /\d$/u.exec(note)?.[0];

  if (pitch === null) {
    return null;
  }

  const noteOctave = written === undefined ? octave : Number(written);
  const letterPitch = pitchClass(note.charAt(0)) ?? 0;
  const accidental = { "#": 1, b: -1 }[note.charAt(1)] ?? 0;

  /* Cb and B# cross the octave line: Cb4 sits just below C4. */
  return (noteOctave + MIDI_OCTAVE_OFFSET) * OCTAVE + letterPitch + accidental;
}

/** A pitch class named as a chord root would be: Eb rather than D#. */
export function pitchClassName(pitch: number): string {
  return ROOT_NAMES[mod(pitch, OCTAVE)] ?? "C";
}

/**
 * The note `letterSteps` letters and `distance` semitones above `root`, spelled from the letter
 * (so a minor third above C is Eb, never D#).
 */
function spellAbove({
  distance,
  letterSteps,
  root,
}: {
  distance: number;
  letterSteps: number;
  root: string;
}): string {
  const rootPitch = pitchClass(root) ?? 0;
  const letterIndex = mod(LETTERS.indexOf(root.charAt(0)) + letterSteps, LETTERS.length);
  const letter = LETTERS.charAt(letterIndex);
  const natural = pitchClass(letter) ?? 0;
  const offset = mod(rootPitch + distance - natural + MAX_ACCIDENTAL, OCTAVE) - MAX_ACCIDENTAL;

  return `${letter}${ACCIDENTALS[offset] ?? ""}`;
}

/** The root without its octave, as written: "Eb4" is "Eb". */
function rootName(note: string): string {
  return note.replace(/\d$/u, "");
}

/** A chord's notes spelled from its root: C minor is C, Eb, G. */
export function spellChord(root: string, quality: ChordQuality): string[] {
  const name = rootName(root);

  return [
    name,
    ...chordIntervals(quality).map((interval, index) =>
      spellAbove({
        distance: semitones(interval),
        letterSteps: (index + 1) * LETTERS_PER_THIRD,
        root: name,
      }),
    ),
  ];
}

/** The note an interval above the root lands on, spelled from the root: a fifth above C is G. */
export function spellInterval(root: string, interval: IntervalName): string {
  const name = rootName(root);

  return spellAbove({
    distance: semitones(interval),
    letterSteps: INTERVAL_LETTER_STEPS[interval],
    root: name,
  });
}

/** A chord voiced upward from its root, as MIDI numbers: C4 minor is 60, 63, 67. */
export function chordMidis(root: string, quality: ChordQuality): number[] {
  const base = noteToMidi(root) ?? 0;
  return [base, ...chordIntervals(quality).map((interval) => base + semitones(interval))];
}

/** The chord a set of pitch classes forms, if any, like `{ root: "C", quality: "minor" }`. */
export function nameChord(
  pitchClasses: readonly number[],
): { quality: ChordQuality; root: string } | null {
  const target = JSON.stringify([...new Set(pitchClasses)].toSorted((a, b) => a - b));

  const match = ROOT_NAMES.flatMap((root) =>
    CHORD_QUALITIES.map((quality) => ({ quality, root })),
  ).find(({ quality, root }) => JSON.stringify(chordPitchClasses(root, quality)) === target);

  return match ?? null;
}

/** Short chord symbols, the way they're written above lyrics: C, Cm, C7, Cmaj7. */
const CHORD_SUFFIXES: Record<ChordQuality, string> = {
  augmented: "aug",
  diminished: "dim",
  dominant7: "7",
  major: "",
  major7: "maj7",
  minor: "m",
  minor7: "m7",
};

export function chordSymbol(root: string, quality: ChordQuality): string {
  return `${rootName(root)}${CHORD_SUFFIXES[quality]}`;
}

/** German names B natural "H" and B flat "B", as learners there read them. */
function germanNoteName(name: string): string {
  if (!name.startsWith("B")) {
    return name;
  }

  return name.startsWith("Bb") ? `B${name.slice(2)}` : `H${name.slice(1)}`;
}

/** A note name for display, with real sharp and flat signs, in the learner's convention. */
export function displayNoteName(name: string, locale: string): string {
  const localName = locale.startsWith("de") ? germanNoteName(name) : name;

  const accidental = /^(?:#{1,2}|b{1,2})/u.exec(localName.slice(1))?.[0] ?? "";
  const signs = accidental.replaceAll("#", "♯").replaceAll("b", "♭");

  return `${localName.charAt(0)}${signs}${localName.slice(1 + accidental.length)}`;
}

/** Whether a pitch class is a black key on the piano (its plain name needs a sharp). */
export function isBlackKey(pitch: number): boolean {
  return (SHARP_NAMES[mod(pitch, OCTAVE)] ?? "").length > 1;
}
