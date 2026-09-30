import { type Lesson, type StepKind, prisma } from "@zoonk/db";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";
import { challengeCaseFixture } from "./challenge-contents";
import { libraryLessonFixture } from "./library-lessons";
import { organizationFixture } from "./orgs";

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

type PlayableStepKind = keyof typeof playableStepContent;

type PlayableStepAttrs = {
  content?: object;
  kind: PlayableStepKind;
  mediaAssetId?: string | null;
  skillId?: string | null;
};

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

/**
 * Creates a Library lesson with its content written: one step per entry, in order, with the
 * shared valid content for its kind unless the entry passes its own.
 */
export async function playableLessonFixture({
  lesson,
  steps = TEACHING_LESSON_STEPS,
}: {
  lesson?: FixtureAttrs<Lesson, "heldBackDrafts" | "spec" | "summary">;
  steps?: (PlayableStepAttrs | PlayableStepKind)[];
} = {}) {
  const created = await libraryLessonFixture({
    contentStatus: "completed",
    specStatus: "completed",
    ...lesson,
  });

  const entries = steps.map((step) => (typeof step === "string" ? { kind: step } : step));

  await prisma.step.createMany({
    data: entries.map((entry, position) => ({
      content: entry.content ?? playableStepContent[entry.kind],
      kind: entry.kind,
      lessonId: created.id,
      mediaAssetId: entry.mediaAssetId ?? null,
      position,
      skillId: entry.skillId ?? null,
      ...fixtureProvenance(),
    })),
  });

  const createdSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    where: { lessonId: created.id },
  });

  return { lesson: created, steps: createdSteps };
}

/**
 * An English lesson for Portuguese speakers with its language pair: the word "rent" and the
 * sentence "How much is the rent?" with their translations, a note and a sound tip, and one
 * vocabulary, translation, reading, listening and "say it out loud" screen on them.
 */
export async function languageLessonFixture() {
  const organization = await organizationFixture();

  const [lesson, word, sentence] = await Promise.all([
    libraryLessonFixture({ contentStatus: "completed", language: "pt", targetLanguage: "en" }),
    prisma.word.create({
      data: {
        organizationId: organization.id,
        pronunciations: {
          create: {
            pronunciation: "rént",
            tip: "O r do começo é suave, não como em rato.",
            userLanguage: "pt",
          },
        },
        targetLanguage: "en",
        word: "rent",
      },
    }),
    prisma.sentence.create({
      data: {
        organizationId: organization.id,
        sentence: "How much is the rent?",
        targetLanguage: "en",
      },
    }),
  ]);

  await Promise.all([
    prisma.lessonWord.create({
      data: {
        distractors: ["deposit", "bill"],
        lessonId: lesson.id,
        note: "Não confunda com renda, que é income.",
        position: 0,
        translation: "aluguel",
        wordId: word.id,
        ...fixtureProvenance(),
      },
    }),
    prisma.lessonSentence.create({
      data: {
        distractors: ["are", "many"],
        explanation: "How much vem antes do verbo, como quanto em português.",
        lessonId: lesson.id,
        position: 0,
        sentenceId: sentence.id,
        translation: "Quanto é o aluguel?",
        translationDistractors: ["renda", "custa"],
        ...fixtureProvenance(),
      },
    }),
    prisma.step.createMany({
      data: [
        { kind: "vocabulary" as const, sentenceId: null, wordId: word.id },
        { kind: "translation" as const, sentenceId: null, wordId: word.id },
        { kind: "reading" as const, sentenceId: sentence.id, wordId: null },
        { kind: "listening" as const, sentenceId: sentence.id, wordId: null },
        {
          content: {
            language: "en",
            prompt: "Pergunte quanto é o aluguel.",
            targetText: "How much is the rent?",
            translation: "Quanto é o aluguel?",
          },
          kind: "spokenAnswer" as const,
          sentenceId: sentence.id,
          wordId: null,
        },
      ].map((step, position) => ({
        content: {},
        ...step,
        lessonId: lesson.id,
        position,
        ...fixtureProvenance(),
      })),
    }),
  ]);

  const steps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    where: { lessonId: lesson.id },
  });

  return { lesson, sentence, steps, word };
}
