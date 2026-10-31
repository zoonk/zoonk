import {
  CHORD_QUALITIES,
  type ChordQuality,
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

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const ROOT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

const LETTERS_PER_THIRD = 2;

const ACCIDENTALS: Record<number, string> = { [-2]: "bb", [-1]: "b", 0: "", 1: "#", 2: "##" };

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}

export function midiToNote(midi: number): string {
  const name = SHARP_NAMES[mod(midi, OCTAVE)] ?? "C";
  return `${name}${Math.floor(midi / OCTAVE) - MIDI_OCTAVE_OFFSET}`;
}

/** Notes without an octave use `octave`. */
export function noteToMidi(note: string, octave = DEFAULT_OCTAVE): number | null {
  const pitch = pitchClass(note);
  const written = /\d$/u.exec(note)?.[0];

  if (pitch === null) {
    return null;
  }

  const noteOctave = written === undefined ? octave : Number(written);
  const letterPitch = pitchClass(note.charAt(0)) ?? 0;
  const accidental = { "#": 1, b: -1 }[note.charAt(1)] ?? 0;

  return (noteOctave + MIDI_OCTAVE_OFFSET) * OCTAVE + letterPitch + accidental;
}

export function pitchClassName(pitch: number): string {
  return ROOT_NAMES[mod(pitch, OCTAVE)] ?? "C";
}

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

function rootName(note: string): string {
  return note.replace(/\d$/u, "");
}

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

export function chordMidis(root: string, quality: ChordQuality): number[] {
  const base = noteToMidi(root) ?? 0;
  return [base, ...chordIntervals(quality).map((interval) => base + semitones(interval))];
}

export function nameChord(
  pitchClasses: readonly number[],
): { quality: ChordQuality; root: string } | null {
  const target = JSON.stringify([...new Set(pitchClasses)].toSorted((a, b) => a - b));

  const match = ROOT_NAMES.flatMap((root) =>
    CHORD_QUALITIES.map((quality) => ({ quality, root })),
  ).find(({ quality, root }) => JSON.stringify(chordPitchClasses(root, quality)) === target);

  return match ?? null;
}

function germanNoteName(name: string): string {
  if (!name.startsWith("B")) {
    return name;
  }

  return name.startsWith("Bb") ? `B${name.slice(2)}` : `H${name.slice(1)}`;
}

export function displayNoteName(name: string, locale: string): string {
  const localName = locale.startsWith("de") ? germanNoteName(name) : name;

  const accidental = /^(?:#{1,2}|b{1,2})/u.exec(localName.slice(1))?.[0] ?? "";
  const signs = accidental.replaceAll("#", "♯").replaceAll("b", "♭");

  return `${localName.charAt(0)}${signs}${localName.slice(1 + accidental.length)}`;
}

export function isBlackKey(pitch: number): boolean {
  return (SHARP_NAMES[mod(pitch, OCTAVE)] ?? "").length > 1;
}
