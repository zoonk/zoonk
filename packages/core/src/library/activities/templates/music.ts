import { z } from "zod";
import { defineActivityTemplate } from "../define-activity-template";
import {
  CHORD_QUALITIES,
  NOTE_PATTERN,
  chordPitchClasses,
  notesPitchClasses,
  rhythmHitSteps,
  rhythmTapTimes,
} from "./_utils/music";
import { issue } from "./_utils/template-helpers";

const MAX_NOTES = 6;
const MAX_NOTATION_LENGTH = 1000;
const MIN_TEMPO = 40;
const MAX_TEMPO = 220;
const MIN_PATTERN_STEPS = 4;
const MAX_PATTERN_STEPS = 32;
const MAX_ROUNDS = 8;
const MAX_STEPS_PER_BEAT = 4;
const MIN_TOLERANCE_MS = 30;
const MAX_TOLERANCE_MS = 200;

const noteSchema = z.string().regex(NOTE_PATTERN);

const keyboardTargetSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("chord"), quality: z.enum(CHORD_QUALITIES), root: noteSchema })
    .strict(),
  z.object({ kind: z.literal("notes"), notes: z.array(noteSchema).min(1).max(MAX_NOTES) }).strict(),
]);

type KeyboardTarget = z.output<typeof keyboardTargetSchema>;

function targetPitchClasses(target: KeyboardTarget): number[] | null {
  return target.kind === "chord"
    ? chordPitchClasses(target.root, target.quality)
    : notesPitchClasses(target.notes);
}

function samePitchClasses(first: KeyboardTarget, second: KeyboardTarget): boolean {
  return JSON.stringify(targetPitchClasses(first)) === JSON.stringify(targetPitchClasses(second));
}

export const keyboardFretboardTemplate = defineActivityTemplate({
  checks: ["interaction", "choice"],
  description:
    'Press notes on a piano keyboard or guitar fretboard and see where they sit on both, like turning C major into C minor. Code draws the keys and frets, computes a chord\'s notes from its root and quality, and plays the sound. Notes are letters with "#" or "b" (C, Eb, F#). With `byEar` the target is played, not named, until the learner answers: ear training, like a perfect fifth (two notes, played one after the other) or a minor chord (played together); the learner finds it on the keys (interaction) or names what they heard (choice, with the names as options). Fills: the notes or chord to find (`target`), optionally the notes or chord already pressed at the start (`start`, for "change one note" tasks), which instruments to show, whether it\'s by ear and, for a choice check, the question about what the learner hears or sees.',
  expected: (fields) => {
    const pitchClasses = targetPitchClasses(fields.target);
    return pitchClasses ? { kind: "pitchClasses", pitchClasses } : null;
  },
  fields: z
    .object({
      byEar: z.boolean().optional(),
      instruments: z
        .array(z.enum(["guitar", "piano"]))
        .min(1)
        .max(2),
      start: keyboardTargetSchema.optional(),
      target: keyboardTargetSchema,
    })
    .strict(),
  id: "keyboardFretboard",
  needsData: false,
  verify: (fields) =>
    [
      new Set(fields.instruments).size !== fields.instruments.length &&
        issue("inconsistentFields", "fields.instruments", "An instrument is listed twice"),
      fields.start !== undefined &&
        samePitchClasses(fields.start, fields.target) &&
        issue("missingInteraction", "fields.start", "The start already is the target"),
    ].filter((item) => item !== false),
});

export const notationPlayerTemplate = defineActivityTemplate({
  checks: ["choice"],
  description:
    "Read a short melody on the staff or as guitar tab while it plays, like Ode to Joy. Notes are written in ABC notation with T: (title), optional C: (composer), M: (meter), L: (unit length) and K: (key) headers, the notes last. Fills: the notes in ABC, the tempo, staff or tab and the check question.",
  fields: z
    .object({
      notation: z.string().min(1).max(MAX_NOTATION_LENGTH),
      tempo: z.number().int().min(MIN_TEMPO).max(MAX_TEMPO),
      view: z.enum(["staff", "tab"]),
    })
    .strict(),
  id: "notationPlayer",
  needsData: false,
  verify: (fields) =>
    /^K:/mu.test(fields.notation) && /^K:.*\n\s*\S/mu.test(fields.notation)
      ? []
      : [
          issue(
            "inconsistentFields",
            "fields.notation",
            "ABC notation needs a K: (key) header line followed by the notes",
          ),
        ],
});

const rhythmFields = z
  .object({
    pattern: z
      .string()
      .min(MIN_PATTERN_STEPS)
      .max(MAX_PATTERN_STEPS)
      .regex(/^[.x]+$/u),
    rounds: z.number().int().min(1).max(MAX_ROUNDS),
    stepsPerBeat: z.number().int().min(1).max(MAX_STEPS_PER_BEAT),
    tempo: z.number().int().min(MIN_TEMPO).max(MAX_TEMPO),
    toleranceMs: z.number().int().min(MIN_TOLERANCE_MS).max(MAX_TOLERANCE_MS),
  })
  .strict();

export const rhythmTapperTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    'Tap along to a rhythm while the device times each tap, like the son clave. It never uses the microphone. The pattern is one bar on a beat grid of "x" (tap) and "." (rest), repeated for each round over a steady click. Fills: the pattern, steps per beat, tempo, number of rounds and how early or late still counts (80 ms or more for beginners).',
  expected: (fields) => ({
    kind: "rhythm",
    tapTimesMs: rhythmTapTimes(fields),
    toleranceMs: fields.toleranceMs,
  }),
  fields: rhythmFields,
  id: "rhythmTapper",
  needsData: false,
  verify: (fields) =>
    [
      rhythmHitSteps(fields.pattern).length < 2 &&
        issue("missingInteraction", "fields.pattern", "A rhythm needs at least two taps"),
      fields.pattern.length % fields.stepsPerBeat !== 0 &&
        issue("inconsistentFields", "fields.pattern", "The pattern must fill whole beats"),
    ].filter((item) => item !== false),
});
