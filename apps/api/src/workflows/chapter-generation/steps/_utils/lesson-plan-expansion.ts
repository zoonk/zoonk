import { type LessonKind } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";

type GeneratedChapterLesson = {
  description: string;
  kind: "alphabet" | "explanation" | "grammar" | "tutorial" | "vocabulary";
  title: string;
};

type ExpandedChapterLesson = {
  description: string;
  kind: LessonKind;
  title: string;
};

type LessonCopy = {
  description: string;
  title: string;
};

type CompanionKind = "listening" | "practice" | "quiz" | "reading" | "review" | "translation";

const ENGLISH_COPY: Record<CompanionKind, LessonCopy> = {
  listening: {
    description: "Listen to sentences built from the latest vocabulary group.",
    title: "Listening practice",
  },
  practice: {
    description: "Apply the previous explanations in a guided problem.",
    title: "Practice",
  },
  quiz: {
    description: "Check the previous practice set with a short quiz.",
    title: "Quiz",
  },
  reading: {
    description: "Read sentences built from the latest vocabulary group.",
    title: "Reading practice",
  },
  review: {
    description: "Review this chapter with practice based on your mistakes.",
    title: "Review",
  },
  translation: {
    description: "Translate the words and phrases from the previous vocabulary lesson.",
    title: "Translation practice",
  },
};

const COPY: Record<string, Record<CompanionKind, LessonCopy>> = {
  en: ENGLISH_COPY,
  es: {
    listening: {
      description: "Escucha oraciones construidas con el grupo de vocabulario más reciente.",
      title: "Práctica de escucha",
    },
    practice: {
      description: "Aplica las explicaciones anteriores en un problema guiado.",
      title: "Práctica",
    },
    quiz: {
      description: "Comprueba la práctica anterior con una prueba breve.",
      title: "Prueba",
    },
    reading: {
      description: "Lee oraciones construidas con el grupo de vocabulario más reciente.",
      title: "Práctica de lectura",
    },
    review: {
      description: "Repasa este capítulo con práctica basada en tus errores.",
      title: "Repaso",
    },
    translation: {
      description: "Traduce las palabras y frases de la lección de vocabulario anterior.",
      title: "Práctica de traducción",
    },
  },
  pt: {
    listening: {
      description: "Escute frases criadas com o grupo de vocabulário mais recente.",
      title: "Prática de escuta",
    },
    practice: {
      description: "Aplique as explicações anteriores em um problema guiado.",
      title: "Prática",
    },
    quiz: {
      description: "Confira a prática anterior com um quiz curto.",
      title: "Quiz",
    },
    reading: {
      description: "Leia frases criadas com o grupo de vocabulário mais recente.",
      title: "Prática de leitura",
    },
    review: {
      description: "Revise este capítulo com prática baseada nos seus erros.",
      title: "Revisão",
    },
    translation: {
      description: "Traduza as palavras e frases da lição de vocabulário anterior.",
      title: "Prática de tradução",
    },
  },
};

const DEFAULT_EXPLANATION_GROUP_SIZE = 2;
const MAX_EXPLANATION_GROUP_SIZE = 3;
const BALANCED_VOCABULARY_COUNT = 4;
const BALANCED_VOCABULARY_GROUP_SIZE = 2;
const MAX_VOCABULARY_GROUP_SIZE = 3;

/**
 * Generated curriculum content is localized by the model, but the companion
 * lessons are deterministic rows created by the app. This helper keeps those
 * generated row labels in the same broad UI language as the surrounding course.
 */
function getCopy({ kind, language }: { kind: CompanionKind; language: string }) {
  return COPY[language]?.[kind] ?? ENGLISH_COPY[kind];
}

/**
 * Explanation lessons are best practiced in pairs, but an odd count should not
 * leave one explanation stranded. Giving the first group three explanations
 * keeps later groups as pairs and matches the chapter cadence the learner sees.
 */
function getExplanationGroupSizes(count: number): number[] {
  if (count === 0) {
    return [];
  }

  if (count <= MAX_EXPLANATION_GROUP_SIZE) {
    return [count];
  }

  if (count % DEFAULT_EXPLANATION_GROUP_SIZE === 1) {
    return [
      MAX_EXPLANATION_GROUP_SIZE,
      ...getExplanationGroupSizes(count - MAX_EXPLANATION_GROUP_SIZE),
    ];
  }

  return [
    DEFAULT_EXPLANATION_GROUP_SIZE,
    ...getExplanationGroupSizes(count - DEFAULT_EXPLANATION_GROUP_SIZE),
  ];
}

/**
 * Vocabulary lessons feed reading/listening lessons in groups of up to three.
 * A final singleton is too thin for a reading/listening pair, so a run of four
 * becomes two groups of two instead of three plus one.
 */
function getVocabularyGroupSizes(count: number): number[] {
  if (count === 0) {
    return [];
  }

  if (count <= MAX_VOCABULARY_GROUP_SIZE) {
    return [count];
  }

  if (count === BALANCED_VOCABULARY_COUNT) {
    return [BALANCED_VOCABULARY_GROUP_SIZE, BALANCED_VOCABULARY_GROUP_SIZE];
  }

  return [MAX_VOCABULARY_GROUP_SIZE, ...getVocabularyGroupSizes(count - MAX_VOCABULARY_GROUP_SIZE)];
}

/**
 * Converts group sizes into the explanation ordinal that should trigger each
 * generated practice lesson while preserving the model's original lesson order.
 */
function getGroupEndOrdinals(sizes: number[], previous = 0): number[] {
  const [size, ...rest] = sizes;

  if (!size) {
    return [];
  }

  const end = previous + size;
  return [end, ...getGroupEndOrdinals(rest, end)];
}

/**
 * Practice and quiz rows are inserted after the explanation groups they assess.
 * Quiz rows cover the explanations since the previous quiz because each quiz
 * appears after every two practice rows, with a final quiz before review.
 */
function expandContentLessons({
  language,
  lessons,
}: {
  language: string;
  lessons: GeneratedChapterLesson[];
}): ExpandedChapterLesson[] {
  const explanationCount = lessons.filter((lesson) => lesson.kind === "explanation").length;

  if (explanationCount === 0) {
    return lessons.map((lesson) => ({ ...lesson, kind: lesson.kind as LessonKind }));
  }

  const groupEnds = new Set(getGroupEndOrdinals(getExplanationGroupSizes(explanationCount)));
  const practiceCopy = getCopy({ kind: "practice", language });
  const quizCopy = getCopy({ kind: "quiz", language });
  const reviewCopy = getCopy({ kind: "review", language });

  const expanded = lessons.reduce(
    (state, lesson) => {
      const nextExplanationCount =
        lesson.kind === "explanation" ? state.explanationCount + 1 : state.explanationCount;
      const shouldAddPractice =
        lesson.kind === "explanation" && groupEnds.has(nextExplanationCount);
      const nextPracticeCount = shouldAddPractice ? state.practiceCount + 1 : state.practiceCount;
      const shouldAddQuiz = shouldAddPractice && nextPracticeCount % 2 === 0;

      return {
        explanationCount: nextExplanationCount,
        practiceCount: nextPracticeCount,
        rows: [
          ...state.rows,
          { ...lesson, kind: lesson.kind as LessonKind },
          ...(shouldAddPractice ? [{ ...practiceCopy, kind: "practice" as const }] : []),
          ...(shouldAddQuiz ? [{ ...quizCopy, kind: "quiz" as const }] : []),
        ],
      };
    },
    { explanationCount: 0, practiceCount: 0, rows: [] as ExpandedChapterLesson[] },
  );

  const needsFinalQuiz = expanded.practiceCount % 2 === 1;

  return [
    ...expanded.rows,
    ...(needsFinalQuiz ? [{ ...quizCopy, kind: "quiz" as const }] : []),
    { ...reviewCopy, kind: "review" as const },
  ];
}

/**
 * Runs of vocabulary lessons create a predictable learning rhythm: each
 * vocabulary lesson gets a translation lesson, then the whole group receives a
 * reading lesson and, when TTS supports it, a listening lesson.
 */
function expandVocabularyRun({
  language,
  lessons,
  targetLanguage,
}: {
  language: string;
  lessons: GeneratedChapterLesson[];
  targetLanguage: string;
}): ExpandedChapterLesson[] {
  const translationCopy = getCopy({ kind: "translation", language });
  const readingCopy = getCopy({ kind: "reading", language });
  const listeningCopy = getCopy({ kind: "listening", language });
  const groups = groupBySizes(lessons, getVocabularyGroupSizes(lessons.length));
  const canGenerateListening = isTTSSupportedLanguage(targetLanguage);

  return groups.flatMap((group) => [
    ...group.flatMap((lesson) => [
      { ...lesson, kind: "vocabulary" as const },
      { ...translationCopy, kind: "translation" as const },
    ]),
    { ...readingCopy, kind: "reading" as const },
    ...(canGenerateListening ? [{ ...listeningCopy, kind: "listening" as const }] : []),
  ]);
}

/**
 * Splits a list into consecutive chunks based on precomputed sizes. The caller
 * owns the size rules, which keeps vocabulary and explanation grouping separate.
 */
function groupBySizes<T>(items: T[], sizes: number[]): T[][] {
  const [size, ...rest] = sizes;

  if (!size) {
    return [];
  }

  return [items.slice(0, size), ...groupBySizes(items.slice(size), rest)];
}

/**
 * Pulls the next contiguous vocabulary run from a language plan. Reading and
 * listening should be based on consecutive vocabulary groups, not vocabulary
 * lessons separated by unrelated grammar or alphabet work.
 */
function takeVocabularyRun(lessons: GeneratedChapterLesson[]) {
  const nextNonVocabularyIndex = lessons.findIndex((lesson) => lesson.kind !== "vocabulary");
  const splitIndex = nextNonVocabularyIndex === -1 ? lessons.length : nextNonVocabularyIndex;

  return {
    rest: lessons.slice(splitIndex),
    run: lessons.slice(0, splitIndex),
  };
}

/**
 * Language plans keep the model-authored grammar/alphabet order and expand only
 * contiguous vocabulary runs. A single chapter-level review is appended after
 * all generated language content.
 */
function expandLanguageLessons({
  language,
  lessons,
  targetLanguage,
}: {
  language: string;
  lessons: GeneratedChapterLesson[];
  targetLanguage: string;
}): ExpandedChapterLesson[] {
  const [firstLesson, ...remainingLessons] = lessons;

  if (!firstLesson) {
    return [];
  }

  if (firstLesson.kind === "vocabulary") {
    const { rest, run } = takeVocabularyRun(lessons);
    return [
      ...expandVocabularyRun({ language, lessons: run, targetLanguage }),
      ...expandLanguageLessons({ language, lessons: rest, targetLanguage }),
    ];
  }

  return [
    { ...firstLesson, kind: firstLesson.kind as LessonKind },
    ...expandLanguageLessons({ language, lessons: remainingLessons, targetLanguage }),
  ];
}

/**
 * Chapter generation returns only substantive model-authored lessons. This
 * function expands that plan into the actual lesson rows the learner will see.
 */
export function expandChapterLessons({
  language,
  lessons,
  targetLanguage,
}: {
  language: string;
  lessons: GeneratedChapterLesson[];
  targetLanguage: string | null;
}): ExpandedChapterLesson[] {
  if (!targetLanguage) {
    return expandContentLessons({ language, lessons });
  }

  const reviewCopy = getCopy({ kind: "review", language });
  const expanded = expandLanguageLessons({ language, lessons, targetLanguage });

  if (expanded.length === 0) {
    return [];
  }

  return [...expanded, { ...reviewCopy, kind: "review" as const }];
}
