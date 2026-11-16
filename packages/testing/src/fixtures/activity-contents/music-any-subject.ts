/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { numericCheck, reasonedChoice } from "./activity-checks";

export const musicAnySubjectActivities = {
  beforeAfter: {
    check: numericCheck(0.12, {
      explanation: "1.5 hours ÷ 12.5 hours = 0.12.",
      output: "hours",
      question: "Divide the 1914 time by the 1912 time. What do you get?",
    }),
    data: { source: { title: "Ford Motor Company production records" } },
    fields: {
      after: {
        description: "The moving line.",
        facts: [{ id: "hours", label: "Hours per car", value: 1.5 }],
        label: "1914",
      },
      before: {
        description: "Cars built in place.",
        facts: [{ id: "hours", label: "Hours per car", value: 12.5 }],
        label: "1912",
      },
      change: "The car moved past the workers.",
    },
    prompt: "What did the moving line change?",
    template: "beforeAfter",
  },
  keyboardFretboard: {
    check: {
      explanation:
        "Moving the middle note down a half step, from E to E♭, makes the chord minor. C and G stay where they are.",
      kind: "interaction",
    },
    fields: {
      instruments: ["piano", "guitar"],
      start: { kind: "chord", quality: "major", root: "C" },
      target: { kind: "chord", quality: "minor", root: "C" },
    },
    prompt: "Change one note to turn C major into C minor.",
    template: "keyboardFretboard",
  },
  notationPlayer: {
    check: reasonedChoice("Does this melody move mostly by steps or by leaps?", [
      {
        isCorrect: true,
        reason: "Almost every note moves to the one next to it: E to F, F to G.",
        text: "By steps",
      },
      {
        isCorrect: false,
        reason: "A leap skips over notes. Here almost every note sits next to the one before.",
        text: "By leaps",
      },
    ]),
    fields: {
      notation:
        "X:1\nT:Ode to Joy\nC:Beethoven, 1824\nM:4/4\nL:1/4\nK:C\nE E F G | G F E D | C C D E | E3/2 D/2 D2 |]",
      tempo: 80,
      view: "staff",
    },
    prompt: "Follow the notes while the melody plays.",
    template: "notationPlayer",
  },
  rhythmTapper: {
    check: {
      explanation:
        "The son clave is three hits, then two: beat 1, just before beat 2, the and of 2, then the and of 3 and beat 4.",
      kind: "interaction",
    },
    fields: {
      pattern: "x..x..x...x.x...",
      rounds: 2,
      stepsPerBeat: 4,
      tempo: 90,
      toleranceMs: 100,
    },
    prompt: "Tap the son clave, a five-hit Cuban rhythm, over the beat.",
    template: "rhythmTapper",
  },
};
