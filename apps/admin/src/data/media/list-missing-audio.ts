import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type Lesson, prisma } from "@zoonk/db";

export const MAX_MISSING_AUDIO_ROWS = 100;

const MAX_LESSONS_PER_ROW = 5;

const lessonLinkSelect = { lesson: { select: { id: true, title: true } } } as const;

type LessonLink = { lesson: Pick<Lesson, "id" | "title"> };

function toMissingAudioResource({
  id,
  lessonCount,
  lessonLinks,
  targetLanguage,
  text,
}: {
  id: string;
  lessonCount: number;
  lessonLinks: LessonLink[];
  targetLanguage: string;
  text: string;
}) {
  return { id, lessonCount, lessons: lessonLinks.map((link) => link.lesson), targetLanguage, text };
}

const cachedListMissingAudio = cacheAdminData(async () => {
  const wordWhere = { audioUrl: null, lessonWords: { some: {} } };
  const sentenceWhere = { audioUrl: null, lessonSentences: { some: {} } };

  const [words, wordTotal, sentences, sentenceTotal] = await Promise.all([
    prisma.word.findMany({
      include: {
        lessonWords: {
          orderBy: { createdAt: "asc" },
          select: lessonLinkSelect,
          take: MAX_LESSONS_PER_ROW,
        },
      },
      orderBy: [{ targetLanguage: "asc" }, { word: "asc" }],
      take: MAX_MISSING_AUDIO_ROWS,
      where: wordWhere,
    }),
    prisma.word.count({ where: wordWhere }),
    prisma.sentence.findMany({
      include: {
        lessonSentences: {
          orderBy: { createdAt: "asc" },
          select: lessonLinkSelect,
          take: MAX_LESSONS_PER_ROW,
        },
      },
      orderBy: [{ targetLanguage: "asc" }, { sentence: "asc" }],
      take: MAX_MISSING_AUDIO_ROWS,
      where: sentenceWhere,
    }),
    prisma.sentence.count({ where: sentenceWhere }),
  ]);

  // Counted for the listed words and sentences only: a relation `_count` would count every
  // word's and sentence's lessons.
  const [wordLessons, sentenceLessons] = await Promise.all([
    prisma.lessonWord.groupBy({
      _count: { lessonId: true },
      by: ["wordId"],
      where: { wordId: { in: words.map((word) => word.id) } },
    }),
    prisma.lessonSentence.groupBy({
      _count: { lessonId: true },
      by: ["sentenceId"],
      where: { sentenceId: { in: sentences.map((sentence) => sentence.id) } },
    }),
  ]);

  const lessonsByWord = new Map(wordLessons.map((row) => [row.wordId, row._count.lessonId]));

  const lessonsBySentence = new Map(
    sentenceLessons.map((row) => [row.sentenceId, row._count.lessonId]),
  );

  return {
    sentenceTotal,
    sentences: sentences.map((sentence) =>
      toMissingAudioResource({
        id: sentence.id,
        lessonCount: lessonsBySentence.get(sentence.id) ?? 0,
        lessonLinks: sentence.lessonSentences,
        targetLanguage: sentence.targetLanguage,
        text: sentence.sentence,
      }),
    ),
    wordTotal,
    words: words.map((word) =>
      toMissingAudioResource({
        id: word.id,
        lessonCount: lessonsByWord.get(word.id) ?? 0,
        lessonLinks: word.lessonWords,
        targetLanguage: word.targetLanguage,
        text: word.word,
      }),
    ),
  };
});

export type MissingAudioResource = Awaited<ReturnType<typeof listMissingAudio>>["words"][number];

export async function listMissingAudio() {
  return cachedListMissingAudio();
}
