import { type Lesson, prisma } from "@zoonk/db";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";
import { libraryLessonFixture } from "./library-lessons";
import { organizationFixture } from "./orgs";
import {
  type PlayableStepKind,
  TEACHING_LESSON_STEPS,
  playableStepContent,
} from "./playable-step-contents";

type PlayableStepAttrs = {
  content?: object;
  kind: PlayableStepKind;
  mediaAssetId?: string | null;
  skillId?: string | null;
};

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
