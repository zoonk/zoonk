import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import {
  type ChordQuality,
  chordPitchClasses,
  notesPitchClasses,
} from "@zoonk/core/library/activities/music";
import { type NoteMarkKind } from "../_components/note-mark";
import { expectedInteraction } from "../_utils/activity-expected";
import { type GuitarVoicing, findGuitarVoicing, stringNoteMidi } from "../_utils/guitar-voicing";
import { midiToNote, nameChord, pitchClassName, spellChord } from "../_utils/music-notes";
import { type ActivityExpected } from "../activity-renderer";

const OCTAVE = 12;

/** The keyboard shows one octave from middle C: every note has one key. */
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

/**
 * How each pitch class is spelled on screen: the way the target writes it (Eb in C minor), then
 * the start, then the usual chord-root names.
 */
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

/** Pressing a key adds its note, or takes it away when it's already there. */
export function togglePitch(pitches: readonly number[], pitch: number): number[] {
  return pitches.includes(pitch)
    ? pitches.filter((item) => item !== pitch)
    : [...pitches, pitch].toSorted((a, b) => a - b);
}

/** Keys to mark while answering: pressed notes, and start notes the learner took away. */
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

/** Keys to mark after the check: each pressed note right or wrong, and any note missing. */
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

/** The notes of an answer, one per pressed key, named the way core grades them. */
export function pitchesToNotes(pitches: readonly number[]): string[] {
  return pitches.map((pitch) => midiToNote(KEYBOARD_FROM + pitch));
}

/** The bass of a guitar shape: the chord's root when the notes form one, else the lowest note. */
function bassOf(pitches: readonly number[]): number {
  const chord = nameChord(pitches);
  const root = chord ? notesPitchClasses([chord.root])?.[0] : undefined;
  return root ?? pitches[0] ?? 0;
}

/** A guitar shape for the pressed notes, or null when one hand can't play them. */
export function voicingFor(pitches: readonly number[]): GuitarVoicing | null {
  return pitches.length === 0
    ? null
    : findGuitarVoicing({ bass: bassOf(pitches), pitchClasses: pitches });
}

/** The notes a guitar shape plays, as pitch classes. */
export function voicingPitches(voicing: GuitarVoicing): number[] {
  const pitches = voicing.flatMap((fret, index) =>
    fret === null ? [] : [stringNoteMidi(index, fret) % OCTAVE],
  );

  return [...new Set(pitches)].toSorted((a, b) => a - b);
}

/** The notes a guitar shape plays, low to high, as MIDI numbers. */
export function voicingMidis(voicing: GuitarVoicing): number[] {
  return voicing.flatMap((fret, index) => (fret === null ? [] : [stringNoteMidi(index, fret)]));
}

/** The window of frets that shows a shape: from the nut unless the shape sits higher up. */
export function fretWindowStart(voicing: GuitarVoicing | null, span: number): number {
  const fretted = (voicing ?? []).filter((fret): fret is number => fret !== null && fret > 0);
  const highest = Math.max(0, ...fretted);

  return highest <= span ? 1 : Math.min(...fretted);
}

/** The pitch classes of the correct answer, from core's computed end state. */
export function expectedPitches(
  expected: ActivityExpected | null,
  fallback: readonly number[],
): number[] {
  return expectedInteraction(expected, "pitchClasses")?.pitchClasses ?? [...fallback];
}

/**
 * Where the notes start: the learner's answer when there is one, else the start chord, else
 * (for a question about the target) the target itself to explore.
 */
export function initialPitches({
  answer,
  content,
}: {
  answer: ActivityAnswer | null;
  content: { check: { kind: string }; fields: { start?: NoteTarget; target: NoteTarget } };
}): number[] {
  const answered = answer?.kind === "notes" ? notesPitchClasses(answer.notes) : null;

  if (answered) {
    return answered;
  }

  const { check, fields } = content;
  return targetPitches(fields.start ?? (check.kind === "interaction" ? undefined : fields.target));
}
