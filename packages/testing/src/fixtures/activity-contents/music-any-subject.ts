/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { choiceCheck, numericCheck } from "./activity-checks";

/** Music and any subject: one valid activity per template. */
export const musicAnySubjectActivities = {
  beforeAfter: {
    check: numericCheck(0.12, { output: "hours" }),
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
  earTrainer: {
    check: {
      explanation:
        "That was a perfect fifth, 7 half steps. A fourth is 5. The fifth is the leap at the start of Twinkle, Twinkle, Little Star.",
      kind: "interaction",
    },
    fields: {
      mode: "interval",
      options: [
        { id: "M3", song: "Oh When the Saints" },
        { id: "P4", song: "Here Comes the Bride" },
        { id: "P5", song: "Twinkle, Twinkle, Little Star" },
        { id: "P8", song: "Somewhere Over the Rainbow" },
      ],
      played: "P5",
      root: "C4",
    },
    prompt: "Which interval do you hear?",
    template: "earTrainer",
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
    check: choiceCheck("Does this melody move mostly by steps or by leaps?", [
      ["By steps", true],
      ["By leaps", false],
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
  predictReveal: {
    check: { ...numericCheck(14), tolerance: { kind: "absolute", value: 2 } },
    data: { source: { title: "The True Size of Africa", year: 2010 } },
    fields: {
      explanation: "The map stretches land near the poles.",
      max: 30,
      min: 1,
      scale: "linear",
      trueValue: 14,
      unit: "times",
    },
    prompt: "How many Greenlands fit in Africa?",
    template: "predictReveal",
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
    prompt: "Tap the son clave over the beat.",
    template: "rhythmTapper",
  },
};
