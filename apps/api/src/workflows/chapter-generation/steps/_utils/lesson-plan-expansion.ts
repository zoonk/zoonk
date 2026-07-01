import { type LessonKind } from "@zoonk/db";
import { isTTSSupportedLanguage, needsRomanization } from "@zoonk/utils/languages";

type GeneratedChapterLesson = {
  description?: string | null;
  kind: "alphabet" | "explanation" | "grammar" | "tutorial" | "vocabulary";
  title?: string | null;
};

export type ExpandedChapterLesson = {
  description: string | null;
  kind: LessonKind;
  title: string | null;
};

type CompanionKind = "listening" | "practice" | "quiz" | "reading" | "review" | "translation";

const BALANCED_VOCABULARY_COUNT = 4;
const BALANCED_VOCABULARY_GROUP_SIZE = 2;
const MAX_VOCABULARY_GROUP_SIZE = 3;

/**
 * Companion lessons are structural rows, not model-authored curriculum items.
 * Keeping copy out of these rows lets the app decide how to label each kind in
 * the current UI language instead of freezing generated titles in the database.
 */
function companionLesson(kind: CompanionKind): ExpandedChapterLesson {
  return { description: null, kind, title: null };
}

/**
 * Model-authored lessons may omit display copy in future planning tasks, so
 * every expansion path normalizes absent values to database nulls before rows
 * are handed to the persistence step.
 */
function authoredLesson({
  kind,
  lesson,
}: {
  kind?: LessonKind;
  lesson: GeneratedChapterLesson;
}): ExpandedChapterLesson {
  return {
    description: lesson.description ?? null,
    kind: kind ?? lesson.kind,
    title: lesson.title ?? null,
  };
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
 * Each explanation receives its own quiz and practice so the interactive rows
 * stay focused on one small concept instead of grouping multiple explanations
 * into a broader checkpoint.
 */
function expandContentLesson({
  lesson,
}: {
  lesson: GeneratedChapterLesson;
}): ExpandedChapterLesson[] {
  const shouldAddInteractiveCompanions = lesson.kind === "explanation";

  return [
    authoredLesson({ lesson }),
    ...(shouldAddInteractiveCompanions
      ? [companionLesson("quiz"), companionLesson("practice")]
      : []),
  ];
}

/**
 * Quiz rows sit directly after the explanation they check. Practice rows cover
 * the same single explanation because each explanation has one quiz and one
 * practice companion before the chapter review.
 */
function expandContentLessons({
  lessons,
}: {
  lessons: GeneratedChapterLesson[];
}): ExpandedChapterLesson[] {
  const hasExplanation = lessons.some((lesson) => lesson.kind === "explanation");

  if (!hasExplanation) {
    return lessons.map((lesson) => authoredLesson({ lesson }));
  }

  return [
    ...lessons.flatMap((lesson) => expandContentLesson({ lesson })),
    companionLesson("review"),
  ];
}

/**
 * Runs of vocabulary lessons create a predictable learning rhythm: each
 * vocabulary lesson gets a translation lesson, then the whole group receives a
 * reading lesson and, when TTS supports it, a listening lesson.
 */
function expandVocabularyRun({
  lessons,
  targetLanguage,
}: {
  lessons: GeneratedChapterLesson[];
  targetLanguage: string;
}): ExpandedChapterLesson[] {
  const groups = groupBySizes(lessons, getVocabularyGroupSizes(lessons.length));
  const canGenerateListening = isTTSSupportedLanguage(targetLanguage);

  return groups.flatMap((group) => [
    ...group.flatMap((lesson) => [
      authoredLesson({ kind: "vocabulary", lesson }),
      companionLesson("translation"),
    ]),
    companionLesson("reading"),
    ...(canGenerateListening ? [companionLesson("listening")] : []),
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

  return { rest: lessons.slice(splitIndex), run: lessons.slice(0, splitIndex) };
}

/**
 * Alphabet lessons only help when the learner must first recognize a writing
 * system that is not written with Roman letters. Models sometimes create
 * alphabet rows for languages like Spanish because the topic is common in
 * beginner curricula, but those rows duplicate pronunciation practice and
 * should never become stored lesson records.
 */
function shouldKeepLanguageLesson({
  lesson,
  targetLanguage,
}: {
  lesson: GeneratedChapterLesson;
  targetLanguage: string;
}) {
  if (lesson.kind !== "alphabet") {
    return true;
  }

  return needsRomanization(targetLanguage);
}

/**
 * Language plans keep the model-authored grammar/alphabet order and expand only
 * contiguous vocabulary runs. A single chapter-level review is appended after
 * all generated language content.
 */
function expandLanguageLessons({
  lessons,
  targetLanguage,
}: {
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
      ...expandVocabularyRun({ lessons: run, targetLanguage }),
      ...expandLanguageLessons({ lessons: rest, targetLanguage }),
    ];
  }

  return [
    authoredLesson({ lesson: firstLesson }),
    ...expandLanguageLessons({ lessons: remainingLessons, targetLanguage }),
  ];
}

/**
 * Chapter generation returns only substantive model-authored lessons. This
 * function expands that plan into the actual lesson rows the learner will see.
 */
export function expandChapterLessons({
  lessons,
  targetLanguage,
}: {
  lessons: GeneratedChapterLesson[];
  targetLanguage: string | null;
}): ExpandedChapterLesson[] {
  if (!targetLanguage) {
    return expandContentLessons({ lessons });
  }

  const filteredLessons = lessons.filter((lesson) =>
    shouldKeepLanguageLesson({ lesson, targetLanguage }),
  );

  const expanded = expandLanguageLessons({ lessons: filteredLessons, targetLanguage });

  if (expanded.length === 0) {
    return [];
  }

  return [...expanded, companionLesson("review")];
}
