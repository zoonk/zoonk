import { type StepKind } from "@zoonk/db";
import { challengeCaseFixture } from "./challenge-contents";

/**
 * Valid content for every teaching screen (step contract v2) and a few language exercises, from
 * one short lesson on why an electron is drawn as a cloud. Typed and spoken answers list accepted
 * answers, so tests that type them are graded by code and never call a model.
 */
export const playableStepContent = {
  activity: {
    check: {
      answer: 5,
      explanation: "−3 + 8 = 5, so it's 5 °C at noon.",
      kind: "numeric",
      question: "What's the temperature at noon?",
      tolerance: { kind: "absolute", value: 0.01 },
      unit: "°C",
    },
    fields: {
      label: "Temperature",
      max: 7,
      min: -5,
      moves: [{ by: 3 }, { by: 5 }],
      start: -3,
      step: 1,
      unit: "°C",
    },
    prompt: "At 7 am it's −3 °C. By noon it's 8 degrees warmer.",
    template: "numberLine",
  },
  challenge: challengeCaseFixture(),
  check: {
    options: [
      {
        id: "path",
        isCorrect: false,
        reason: "There is no exact path to show: the electron doesn't follow one.",
        text: "The electron's exact path",
      },
      {
        id: "likely",
        isCorrect: true,
        reason:
          "The cloud shows chances, not a path. Where it's densest, the electron is most likely.",
        text: "Where the electron is most likely to be found",
      },
      {
        id: "size",
        isCorrect: false,
        reason: "The cloud is far bigger than the electron. It maps chances, not size.",
        text: "The electron's size",
      },
    ],
    question: 'What does the electron "cloud" show?',
  },
  explanation: {
    exampleLineSlot: { idea: "a blur that shows where something fast might be" },
    text: "The electron doesn't circle the nucleus like a planet. It spreads out into a **cloud of possibilities**: a map of where it might be.",
    title: "A cloud, not a little ball",
  },
  fillBlank: {
    answers: ["cloud"],
    distractors: ["orbit", "ring"],
    feedback: "The electron is described by a cloud of chances.",
    question: "Fill in the blank",
    template: "The electron is drawn as a [BLANK].",
  },
  hook: {
    options: [
      { id: "yes", isCorrect: false, text: "Yes, exactly" },
      { id: "sort-of", isCorrect: false, text: "Sort of" },
      { id: "no", isCorrect: true, text: "No" },
    ],
    question: "Does the electron circle the nucleus the way Earth circles the Sun?",
    reveal:
      "No. The electron doesn't follow a path at all. It spreads around the nucleus like a cloud.",
    variant: "guess",
  },
  multipleChoice: {
    options: [
      { feedback: "Right: a cloud of chances.", id: "cloud", isCorrect: true, text: "A cloud" },
      {
        feedback: "That's the old planet picture.",
        id: "orbit",
        isCorrect: false,
        text: "An orbit",
      },
    ],
    question: "How do we picture an electron today?",
  },
  spokenAnswer: {
    language: "en",
    prompt: "Say it out loud",
    targetText: "The electron is a cloud",
  },
  summary: {
    ideas: [
      { text: "An electron doesn't follow a path around the nucleus." },
      { text: "It's described by a cloud: a map of where it's likely to be." },
      { text: "Where the cloud is densest, you're most likely to find it." },
    ],
  },
  typedAnswer: {
    acceptedAnswers: ["It shows where the electron is likely to be"],
    keyPoints: [
      "We can't know the electron's exact position or path",
      "The cloud shows where it's likely to be found",
    ],
    question: "In your own words: why is the electron drawn as a cloud?",
    sampleAnswer:
      "Because we can't pin down where the electron is. The cloud maps where it's most likely to be.",
  },
  workedExample: {
    problem:
      "The cloud is darkest just around the nucleus and fades farther out. Where are you most likely to find the electron?",
    result: "Most likely just around the nucleus, where the cloud is densest.",
    steps: [
      { text: "Darker means more likely: the shade shows the chance of finding it there." },
      { text: "The darkest part sits just around the nucleus." },
      { text: "So that's where you'd most likely find the electron." },
    ],
    title: "Reading the cloud",
  },
} satisfies Partial<Record<StepKind, object>>;

export type PlayableStepKind = keyof typeof playableStepContent;

/** Every teaching screen once, in the order a lesson uses them. */
export const TEACHING_LESSON_STEPS: PlayableStepKind[] = [
  "hook",
  "explanation",
  "workedExample",
  "check",
  "typedAnswer",
  "spokenAnswer",
  "summary",
];
