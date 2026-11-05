import { randomUUID } from "node:crypto";
import { type Lesson, type LessonIcon, prisma } from "@zoonk/db";
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
  /** Core's saved marks (`savedStepMarksSchema`). */
  marks?: object;
  mediaAssetId?: string | null;
  skillId?: string | null;
};

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
      marks: entry.marks,
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

/** A drawn icon; its files don't exist, since clients treat icons as decoration. */
export async function lessonIconFixture(attrs: Partial<LessonIcon> = {}) {
  const key = randomUUID();

  return prisma.lessonIcon.create({
    data: {
      description: "A test drawing.",
      generatedAt: new Date(),
      name: `test icon ${key}`,
      smallUrl: `https://example.test/icons/${key}-96.webp`,
      status: "completed",
      styleVersion: 1,
      tags: ["test"],
      url: `https://example.test/icons/${key}-256.webp`,
      ...attrs,
    },
  });
}

function savedMarks(marks: {
  example?: string;
  iconId?: string;
  ideaIndex: number;
  underline?: string;
}) {
  return {
    example: marks.example ?? null,
    iconId: marks.iconId ?? null,
    iconPending: false,
    ideaIndex: marks.ideaIndex,
    underline: marks.underline ?? null,
  };
}

/**
 * A tagged lesson with its icons drawn: a map whose ideas have `about` lines and icons, and
 * screens with their idea, an underline, an example and an icon.
 */
export async function markedPlayableLessonFixture({
  lesson,
}: { lesson?: FixtureAttrs<Lesson, "heldBackDrafts" | "spec" | "summary"> } = {}) {
  const [cloud, nucleus] = await Promise.all([
    lessonIconFixture({ name: `electron cloud ${randomUUID()}`, tags: ["electron", "cloud"] }),
    lessonIconFixture({ name: `atom nucleus ${randomUUID()}`, tags: ["atom", "nucleus"] }),
  ]);

  const created = await playableLessonFixture({
    lesson: {
      summary: {
        ideas: [
          {
            about: "What the electron does around the nucleus",
            iconId: cloud.id,
            label: "A cloud, not an orbit",
            text: "The electron spreads around the nucleus as a cloud of chances, not along a path.",
          },
          {
            about: "How to read the cloud",
            iconId: nucleus.id,
            label: "Reading the cloud",
            text: "The darker the cloud, the likelier the electron is there.",
          },
        ],
        shape: "hub",
      },
      ...lesson,
    },
    steps: [
      { kind: "hook", marks: savedMarks({ ideaIndex: 0 }) },
      {
        kind: "explanation",
        marks: savedMarks({
          example: "The electron doesn't circle the nucleus like a planet.",
          iconId: cloud.id,
          ideaIndex: 0,
          underline: "a map of where it might be",
        }),
      },
      {
        kind: "workedExample",
        marks: savedMarks({ ideaIndex: 1, underline: "darkest just around the nucleus" }),
      },
      { kind: "check", marks: savedMarks({ ideaIndex: 1 }) },
    ],
  });

  return { ...created, icons: { cloud, nucleus } };
}

export async function languageLessonFixture({
  language = "pt",
  sentenceAudioUrl = null,
  sentenceText = "How much is the rent?",
  sentenceTranslation = "Quanto é o aluguel?",
  wordTranslation = "aluguel",
}: {
  language?: string;
  sentenceAudioUrl?: string | null;
  sentenceText?: string;
  sentenceTranslation?: string;
  wordTranslation?: string;
} = {}) {
  const organization = await organizationFixture();

  const [lesson, word, sentence] = await Promise.all([
    libraryLessonFixture({ contentStatus: "completed", language, targetLanguage: "en" }),
    prisma.word.create({
      data: {
        organizationId: organization.id,
        pronunciations: {
          create: {
            pronunciation: "rént",
            tip: "O r do começo é suave, não como em rato.",
            userLanguage: language,
          },
        },
        targetLanguage: "en",
        word: "rent",
      },
    }),
    prisma.sentence.create({
      data: {
        audioUrl: sentenceAudioUrl,
        organizationId: organization.id,
        sentence: sentenceText,
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
        translation: wordTranslation,
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
        translation: sentenceTranslation,
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
            targetText: sentenceText,
            translation: sentenceTranslation,
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
