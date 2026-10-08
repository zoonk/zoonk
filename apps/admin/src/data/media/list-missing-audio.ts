import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type Lesson, prisma } from "@zoonk/db";

/** Uploading clears a row, so the queue shows a working batch rather than paginating. */
export const MAX_MISSING_AUDIO_ROWS = 100;

/** A shared word can sit in many lessons; a few are enough to open one and hear the context. */
const MAX_LESSONS_PER_ROW = 5;

const lessonLinkSelect = { lesson: { select: { id: true, title: true } } } as const;

type LessonLink = { lesson: Pick<Lesson, "id" | "title"> };

/** Words and sentences become the same row shape: the text, its language and the lessons using it. */
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
        _count: { select: { lessonWords: true } },
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
        _count: { select: { lessonSentences: true } },
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

  return {
    sentenceTotal,
    sentences: sentences.map((sentence) =>
      toMissingAudioResource({
        id: sentence.id,
        lessonCount: sentence._count.lessonSentences,
        lessonLinks: sentence.lessonSentences,
        targetLanguage: sentence.targetLanguage,
        text: sentence.sentence,
      }),
    ),
    wordTotal,
    words: words.map((word) =>
      toMissingAudioResource({
        id: word.id,
        lessonCount: word._count.lessonWords,
        lessonLinks: word.lessonWords,
        targetLanguage: word.targetLanguage,
        text: word.word,
      }),
    ),
  };
});

export type MissingAudioResource = Awaited<ReturnType<typeof listMissingAudio>>["words"][number];

/**
 * Words and sentences that Library language lessons use but that have no
 * audio yet. Audio is shared per target language, so one upload fixes every
 * lesson that uses the word or sentence.
 */
export async function listMissingAudio() {
  return cachedListMissingAudio();
}
