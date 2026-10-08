import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { fixtureProvenance } from "./_utils/fixture-attrs";
import { courseFixture } from "./courses";
import { goalFixture, planFixture, planItemFixture } from "./goals";
import { courseChapterFixture, libraryChapterFixture } from "./library-chapters";
import { chapterLessonFixture, libraryLessonFixture } from "./library-lessons";
import { userFixture } from "./users";

/** Linda on Queen Street: a unit's call at A2, stored so starting a call needs no model. */
export const RENTING_SCENARIO = {
  character: { name: "Linda", place: "Queen Street", role: "proprietária" },
  characterBrief: "A friendly landlord. Rent is $2,400; viewings on Saturday.",
  hints: ["Is it still available?", "Can I see it on Saturday?"],
  objectives: [
    { description: "Perguntar se está livre", label: "Is it available?" },
    { description: "Marcar uma visita", label: "Book a viewing" },
    { description: "Perguntar a caução", label: "Ask about the deposit" },
  ],
  openingLine: "Hi! Are you calling about the apartment?",
  situation: "Você liga para a proprietária de um apartamento.",
  title: "Ligar para marcar uma visita",
};

/**
 * A Portuguese speaker learning English: a course with two units (arriving, then renting, each with
 * two lessons), an active language goal on it with a plan, and the renting unit's call cached at A2.
 */
export async function languageGoalFixture({ userId }: { userId?: string } = {}) {
  const [user, course] = await Promise.all([
    userId ? prisma.user.findUniqueOrThrow({ where: { id: userId } }) : userFixture(),
    courseFixture({ language: "pt" }),
  ]);

  const [arriving, renting] = await Promise.all(
    ["Chegando", "Alugando um apartamento"].map((title, index) =>
      libraryChapterFixture({
        language: "pt",
        objectives: [`Consigo fazer a parte ${index + 1}`],
        targetLanguage: "en",
        title,
      }),
    ),
  );

  if (!arriving || !renting) {
    throw new Error("Units weren't created");
  }

  await Promise.all([
    courseChapterFixture({ chapterId: arriving.id, courseId: course.id, position: 0 }),
    courseChapterFixture({ chapterId: renting.id, courseId: course.id, position: 1 }),
  ]);

  const lessons = await Promise.all(
    [arriving, arriving, renting, renting].map((chapter, index) =>
      libraryLessonFixture({
        homeChapterId: chapter.id,
        language: "pt",
        targetLanguage: "en",
        title: `Lição ${index + 1}`,
      }),
    ),
  );

  await Promise.all(
    lessons.map((lesson, index) =>
      chapterLessonFixture({
        chapterId: index < 2 ? arriving.id : renting.id,
        lessonId: lesson.id,
        position: index % 2,
      }),
    ),
  );

  const goal = await goalFixture({
    details: { level: "A2", reason: "Mudança para Toronto", targetLevel: "B1+" },
    kind: "language",
    language: "pt",
    primaryCourseId: course.id,
    targetLanguage: "en",
    title: "Inglês para Toronto",
    userId: user.id,
  });

  const plan = await planFixture({ goalId: goal.id });

  const items = await Promise.all(
    lessons.map((lesson, index) =>
      planItemFixture({
        chapterId: lesson.homeChapterId,
        lessonId: lesson.id,
        phase: index < 2 ? 0 : 1,
        planId: plan.id,
        position: index,
      }),
    ),
  );

  await prisma.conversationScenario.create({
    data: {
      chapterId: renting.id,
      content: RENTING_SCENARIO,
      level: "A2",
      model: "test",
      promptVersion: "test",
      runId: "test",
    },
  });

  return { arriving, course, goal, items, lessons, plan, renting, user };
}

/** The first letters of a few scripts, for alphabet lessons tests read without a model. */
const FIRST_LETTERS: Record<
  "ja" | "ko" | "ru",
  { letters: [symbol: string, readingAid: string][]; script: string }
> = {
  ja: {
    letters: [
      ["あ", "a"],
      ["か", "ka"],
    ],
    script: "hiragana",
  },
  ko: {
    letters: [
      ["ㅏ", "a"],
      ["ㄴ", "n"],
    ],
    script: "hangul",
  },
  ru: {
    letters: [
      ["Д", "d"],
      ["Ж", "zh"],
    ],
    script: "cirílico",
  },
};

/**
 * A script's published alphabet lesson for Portuguese speakers, found or created, as learners of
 * the pair share it: an intro, a card per letter (the first with its clip), a match and the
 * summary. Pass the key core gives the script (`getAlphabetIdentityKey`); concurrent calls get one
 * lesson.
 */
export async function alphabetLessonFixture({
  identityKey,
  targetLanguage,
}: {
  identityKey: string;
  targetLanguage: keyof typeof FIRST_LETTERS;
}) {
  const { letters, script } = FIRST_LETTERS[targetLanguage];
  const title = `Seu primeiro ${script}`;

  const lesson = await prisma.lesson.upsert({
    create: {
      canDo: `Ler e dizer as primeiras letras do ${script}`,
      contentStatus: "completed",
      description: `As primeiras letras do ${script}.`,
      estimatedMinutes: 5,
      identityKey,
      language: "pt",
      level: "beginner",
      normalizedTitle: normalizeString(title),
      slug: `alphabet-${targetLanguage}-${randomUUID()}`,
      targetLanguage,
      title,
      ...fixtureProvenance(),
    },
    update: {},
    where: { languageIdentity: { identityKey, language: "pt" } },
  });

  const steps = [
    {
      content: { text: `Cada letra do ${script} tem um som.`, title: "Um som por letra" },
      kind: "explanation" as const,
    },
    ...letters.map(([symbol, readingAid], index) => ({
      content: {
        audioText: symbol,
        audioUrl:
          index === 0 ? `https://audio.zoonk.test/${targetLanguage}-${readingAid}.mp3` : null,
        forms: [],
        pronunciation: `Como o ${readingAid} de casa.`,
        readingAid,
        symbol,
      },
      kind: "alphabet" as const,
    })),
    {
      content: {
        pairs: letters.map(([symbol, readingAid]) => ({ left: symbol, right: readingAid })),
      },
      kind: "matchColumns" as const,
    },
    {
      content: { ideas: [{ text: `Você já lê ${letters.length} letras.` }] },
      kind: "summary" as const,
    },
  ];

  await prisma.step.createMany({
    data: steps.map((step, position) => ({
      ...step,
      ...fixtureProvenance(),
      lessonId: lesson.id,
      position,
    })),
    skipDuplicates: true,
  });

  return lesson;
}
