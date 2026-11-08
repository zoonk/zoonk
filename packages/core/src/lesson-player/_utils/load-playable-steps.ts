import "server-only";
import { prisma } from "@zoonk/db";
import { isSameLanguage } from "@zoonk/utils/languages";
import { MAX_SENTENCE_ORDERS_ATTEMPTS } from "../../library/language/sentence-orders-constants";
import { listTargetBankWords } from "../../player/contracts/build-word-bank-options";
import { type PlayableLibraryStep, type PlayableWordHints } from "../playable-lesson";
import { type LessonPairResources, type PlayableStepRow, toPlayableSteps } from "./playable-step";

const NO_RESOURCES: LessonPairResources = {
  distractorWords: [],
  lessonSentences: [],
  lessonWords: [],
  sentenceWords: [],
  wordHints: new Map(),
};

type ExerciseLesson = {
  id: string;
  language: string;
  sentenceOrdersAttempts: number;
  targetLanguage: string | null;
};

type WordRow = {
  audioUrl: string | null;
  id: string;
  pronunciations: { pronunciation: string; tip: string | null }[];
  romanization: string | null;
  word: string;
};

function toWordData({
  distractors,
  translation,
  word,
}: {
  distractors: string[];
  translation: string;
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

async function loadTargetWords({
  targetLanguage,
  texts,
}: {
  targetLanguage: string;
  texts: string[];
}) {
  if (texts.length === 0) {
    return [];
  }

  return prisma.word.findMany({
    select: { audioUrl: true, id: true, romanization: true, word: true },
    where: { targetLanguage, word: { in: [...new Set(texts)], mode: "insensitive" } },
  });
}

async function loadExerciseResources({
  lesson,
  rows,
}: {
  lesson: ExerciseLesson;
  rows: PlayableStepRow[];
}): Promise<LessonPairResources> {
  const { targetLanguage } = lesson;

  if (!targetLanguage || !rows.some((row) => row.wordId || row.sentenceId)) {
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

  const bankWords = listTargetBankWords({
    sentences: new Map(
      lessonSentences.map((link) => [
        link.sentenceId,
        { distractors: link.distractors, sentence: link.sentence.sentence },
      ]),
    ),
    steps: rows,
  });

  const targetWords = await loadTargetWords({
    targetLanguage,
    texts: [...lessonWords.flatMap((link) => link.distractors), ...bankWords],
  });

  const words = lessonWords.map((link) => toWordData(link));

  return {
    distractorWords: targetWords,
    lessonSentences: lessonSentences.map((link) => ({
      audioUrl: link.sentence.audioUrl,
      distractors: link.distractors,
      explanation: link.explanation,
      id: link.sentence.id,
      ordersPending:
        link.ordersOwedAt !== null && lesson.sentenceOrdersAttempts < MAX_SENTENCE_ORDERS_ATTEMPTS,
      otherSentenceOrders: link.otherSentenceOrders,
      otherTranslationOrders: link.otherTranslationOrders,
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

export async function loadPlayableSteps({
  lesson,
  rows,
}: {
  lesson: ExerciseLesson;
  rows: PlayableStepRow[];
}): Promise<PlayableLibraryStep[]> {
  const resources = await loadExerciseResources({ lesson, rows });

  const sameLanguage = lesson.targetLanguage
    ? isSameLanguage({ learnerLanguage: lesson.language, targetLanguage: lesson.targetLanguage })
    : false;

  const languages = {
    language: lesson.language,
    targetLanguage: lesson.targetLanguage ?? lesson.language,
  };

  return toPlayableSteps({ languages, resources, rows, sameLanguage });
}
