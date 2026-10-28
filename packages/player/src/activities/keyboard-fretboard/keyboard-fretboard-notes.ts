import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import {
  type ChordQuality,
  chordPitchClasses,
  notesPitchClasses,
} from "@zoonk/core/library/activities/music";
import { type NoteMarkKind } from "../_components/note-mark";
import { expectedInteraction } from "../_utils/activity-expected";
import { type GuitarVoicing, findGuitarVoicing, stringNoteMidi } from "../_utils/guitar-voicing";
import {
  chordMidis,
  midiToNote,
  nameChord,
  noteToMidi,
  pitchClassName,
  spellChord,
} from "../_utils/music-notes";
import { type SoundEvent, oneByOne, together } from "../_utils/sound-events";
import { type ActivityExpected, type ActivityPhase } from "../activity-renderer";

const OCTAVE = 12;

export const KEYBOARD_FROM = 60;
export const KEYBOARD_TO = 71;

export type NoteTarget =
  | { kind: "chord"; quality: ChordQuality; root: string }
  | { kind: "notes"; notes: string[] };

export function targetPitches(target?: NoteTarget): number[] {
  if (!target) {
    return [];
  }

  const pitches =
    target.kind === "chord"
      ? chordPitchClasses(target.root, target.quality)
      : notesPitchClasses(target.notes);

  return pitches ?? [];
}

function targetSpelling(target: NoteTarget | undefined): string[] {
  if (!target) {
    return [];
  }

  return target.kind === "chord"
    ? spellChord(target.root, target.quality)
    : target.notes.map((note) => note.replace(/\d$/u, ""));
}

export function pitchSpelling(targets: readonly (NoteTarget | undefined)[]) {
  const spelled = new Map(
    targets
      .toReversed()
      .flatMap((target) => targetSpelling(target))
      .flatMap((name) => {
        const pitch = notesPitchClasses([name])?.[0];
        return pitch === undefined ? [] : [[pitch, name] as const];
      }),
  );

  return (pitch: number): string => spelled.get(pitch % OCTAVE) ?? pitchClassName(pitch);
}

export function togglePitch(pitches: readonly number[], pitch: number): number[] {
  return pitches.includes(pitch)
    ? pitches.filter((item) => item !== pitch)
    : [...pitches, pitch].toSorted((a, b) => a - b);
}

export function answeringMarks({
  pressed,
  start,
}: {
  pressed: readonly number[];
  start: readonly number[];
}): Map<number, NoteMarkKind> {
  return new Map([
    ...start
      .filter((pitch) => !pressed.includes(pitch))
      .map((pitch) => [KEYBOARD_FROM + pitch, "removed" as const] as const),
    ...pressed.map(
      (pitch) => [KEYBOARD_FROM + pitch, start.includes(pitch) ? "kept" : "new"] as const,
    ),
  ]);
}

export function checkedMarks({
  expected,
  pressed,
}: {
  expected: readonly number[];
  pressed: readonly number[];
}): Map<number, NoteMarkKind> {
  return new Map([
    ...expected
      .filter((pitch) => !pressed.includes(pitch))
      .map((pitch) => [KEYBOARD_FROM + pitch, "missed" as const] as const),
    ...pressed.map(
      (pitch) => [KEYBOARD_FROM + pitch, expected.includes(pitch) ? "correct" : "wrong"] as const,
    ),
  ]);
}

export function pitchesToNotes(pitches: readonly number[]): string[] {
  return pitches.map((pitch) => midiToNote(KEYBOARD_FROM + pitch));
}

function bassOf(pitches: readonly number[]): number {
  const chord = nameChord(pitches);
  const root = chord ? notesPitchClasses([chord.root])?.[0] : undefined;
  return root ?? pitches[0] ?? 0;
}

export function voicingFor(pitches: readonly number[]): GuitarVoicing | null {
  return pitches.length === 0
    ? null
    : findGuitarVoicing({ bass: bassOf(pitches), pitchClasses: pitches });
}

export function voicingPitches(voicing: GuitarVoicing): number[] {
  const pitches = voicing.flatMap((fret, index) =>
    fret === null ? [] : [stringNoteMidi(index, fret) % OCTAVE],
  );

  return [...new Set(pitches)].toSorted((a, b) => a - b);
}

export function voicingMidis(voicing: GuitarVoicing): number[] {
  return voicing.flatMap((fret, index) => (fret === null ? [] : [stringNoteMidi(index, fret)]));
}

export function fretWindowStart(voicing: GuitarVoicing | null, span: number): number {
  const fretted = (voicing ?? []).filter((fret): fret is number => fret !== null && fret > 0);
  const highest = Math.max(0, ...fretted);

  return highest <= span ? 1 : Math.min(...fretted);
}

export function expectedPitches(
  expected: ActivityExpected | null,
  fallback: readonly number[],
): number[] {
  return expectedInteraction(expected, "pitchClasses")?.pitchClasses ?? [...fallback];
}

export function initialPitches({
  answer,
  content,
  phase,
}: {
  answer: ActivityAnswer | null;
  content: {
    check: { kind: string };
    fields: { byEar?: boolean; start?: NoteTarget; target: NoteTarget };
  };
  phase: ActivityPhase;
}): number[] {
  const answered = answer?.kind === "notes" ? notesPitchClasses(answer.notes) : null;

  if (answered) {
    return answered;
  }

  const { check, fields } = content;
  const showsTarget = fields.byEar ? phase === "explore" : check.kind !== "interaction";

  return targetPitches(fields.start ?? (showsTarget ? fields.target : undefined));
}

const MELODY_GAP = 0.7;
const CHORD_GAP = 0.03;

export function targetSound(target: NoteTarget): SoundEvent[] {
  if (target.kind === "chord") {
    return together(chordMidis(target.root, target.quality), { gap: CHORD_GAP });
  }

  const midis = target.notes.reduce<number[]>((played, note) => {
    const midi = noteToMidi(note) ?? KEYBOARD_FROM;
    const previous = played.at(-1);
    played.push(previous === undefined || midi > previous ? midi : midi + OCTAVE);

    return played;
  }, []);

  return oneByOne(midis, MELODY_GAP);
}
