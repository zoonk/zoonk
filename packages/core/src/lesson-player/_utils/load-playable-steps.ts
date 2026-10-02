import "server-only";
import { prisma } from "@zoonk/db";
import { deduplicateNormalizedTexts } from "@zoonk/utils/string";
import { type PlayableLibraryStep, type PlayableWordHints } from "../contract";
import { type LessonPairResources, type PlayableStepRow, toPlayableSteps } from "./playable-step";

const NO_RESOURCES: LessonPairResources = {
  distractorWords: [],
  lessonSentences: [],
  lessonWords: [],
  sentenceWords: [],
  wordHints: new Map(),
};

type ExerciseLesson = { id: string; language: string; targetLanguage: string | null };

type WordRow = {
  audioUrl: string | null;
  id: string;
  pronunciations: { pronunciation: string; tip: string | null }[];
  romanization: string | null;
  word: string;
};

function toWordData({
  distractors = [],
  translation = "",
  word,
}: {
  distractors?: string[];
  translation?: string;
  word: WordRow;
}) {
  return {
    audioUrl: word.audioUrl,
    distractors,
    id: word.id,
    pronunciation: word.pronunciations[0]?.pronunciation ?? null,
    romanization: word.romanization,
    translation,
    word: word.word,
  };
}

/** Target-language words behind the wrong options, for their audio and pronunciation. */
async function loadDistractorWords({ lesson, texts }: { lesson: ExerciseLesson; texts: string[] }) {
  const distractorTexts = deduplicateNormalizedTexts(texts);

  if (!lesson.targetLanguage || distractorTexts.length === 0) {
    return [];
  }

  const words = await prisma.word.findMany({
    include: { pronunciations: { where: { userLanguage: lesson.language } } },
    where: {
      targetLanguage: lesson.targetLanguage,
      word: { in: distractorTexts, mode: "insensitive" },
    },
  });

  return words.map((word) => toWordData({ word }));
}

/**
 * The lesson's words and sentences with their meaning in the learner's language (the pair's
 * links), notes and sound tips, plus the target-language words its wrong options use. Word and
 * sentence exercises read these; lessons without them skip every query.
 */
async function loadExerciseResources({
  lesson,
  rows,
}: {
  lesson: ExerciseLesson;
  rows: { sentenceId: string | null; wordId: string | null }[];
}): Promise<LessonPairResources> {
  if (!rows.some((row) => row.wordId || row.sentenceId)) {
    return NO_RESOURCES;
  }

  const [lessonWords, lessonSentences] = await Promise.all([
    prisma.lessonWord.findMany({
      include: {
        word: { include: { pronunciations: { where: { userLanguage: lesson.language } } } },
      },
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    }),
    prisma.lessonSentence.findMany({
      include: { sentence: true },
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    }),
  ]);

  const distractorWords = await loadDistractorWords({
    lesson,
    texts: [...lessonWords, ...lessonSentences].flatMap((link) => link.distractors),
  });

  const words = lessonWords.map((link) => toWordData(link));

  return {
    distractorWords,
    lessonSentences: lessonSentences.map((link) => ({
      audioUrl: link.sentence.audioUrl,
      distractors: link.distractors,
      explanation: link.explanation,
      id: link.sentence.id,
      romanization: link.sentence.romanization,
      sentence: link.sentence.sentence,
      translation: link.translation,
      translationDistractors: link.translationDistractors,
    })),
    lessonWords: words,
    sentenceWords: words,
    wordHints: new Map(
      lessonWords.flatMap((link): [string, PlayableWordHints][] => {
        const note = link.note ?? null;
        const pronunciationTip = link.word.pronunciations[0]?.tip ?? null;
        return note || pronunciationTip ? [[link.wordId, { note, pronunciationTip }]] : [];
      }),
    ),
  };
}

/** The screens a lesson serves from these stored steps, with their language pair when needed. */
export async function loadPlayableSteps({
  lesson,
  rows,
}: {
  lesson: ExerciseLesson;
  rows: PlayableStepRow[];
}): Promise<PlayableLibraryStep[]> {
  const resources = await loadExerciseResources({ lesson, rows });
  return toPlayableSteps({ resources, rows });
}
