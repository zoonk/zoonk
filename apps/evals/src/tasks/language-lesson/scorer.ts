import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { type LanguageLessonContent } from "@zoonk/ai/tasks/language/language-lesson";
import { definitionNamesWord } from "@zoonk/ai/tasks/language/language-lesson-rules";
import { keepSentenceOrders } from "@zoonk/core/library/language/sentence-orders";
import { isSameLanguage } from "@zoonk/utils/languages";
import { LANGUAGE_LESSON_SCORE_CATEGORIES } from "./score-categories";
import { type LanguageLessonInput } from "./test-cases";

type Sentence = LanguageLessonContent["sentences"][number];

function parseLesson(output: string): LanguageLessonContent | null {
  try {
    return JSON.parse(output) as LanguageLessonContent;
  } catch {
    return null;
  }
}

function checkDefinitions(
  lesson: LanguageLessonContent,
): Omit<CodeCheckResult, "judgedOutput"> & { words: LanguageLessonContent["words"] } {
  const named = lesson.words.filter((word) =>
    definitionNamesWord({ definition: word.translation, word: word.word }),
  );

  return {
    passed: lesson.words.length - named.length,
    problems: named.map((word) => `"${word.word}" is defined as "${word.translation}".`),
    total: lesson.words.length,
    words: lesson.words.filter((word) => !named.includes(word)),
  };
}

/** The pipeline keeps only orders built from a sentence's own tiles, so the judge reads those. */
function checkOrders({
  lesson,
  sameLanguage,
}: {
  lesson: LanguageLessonContent;
  sameLanguage: boolean;
}): Omit<CodeCheckResult, "judgedOutput"> & { sentences: LanguageLessonContent["sentences"] } {
  const checked = lesson.sentences.map((sentence) => {
    const keeps = (orders: Pick<Sentence, "otherOrders" | "otherTranslationOrders">) => {
      const kept = keepSentenceOrders({ sameLanguage, sentence: { ...sentence, ...orders } });
      return kept.otherOrders.length + kept.otherTranslationOrders.length > 0;
    };

    const dropped = [
      ...sentence.otherOrders.filter(
        (order) => !keeps({ otherOrders: [order], otherTranslationOrders: [] }),
      ),
      ...(sameLanguage ? [] : sentence.otherTranslationOrders).filter(
        (order) => !keeps({ otherOrders: [], otherTranslationOrders: [order] }),
      ),
    ];

    return {
      dropped,
      sentence: { ...sentence, ...keepSentenceOrders({ sameLanguage, sentence }) },
    };
  });

  const failed = checked.filter((item) => item.dropped.length > 0);

  return {
    passed: checked.length - failed.length,
    problems: failed.map(
      (item) =>
        `"${item.sentence.sentence}" has other orders that aren't another order of its own words: ${item.dropped.map((order) => `"${order}"`).join(", ")}.`,
    ),
    sentences: checked.map((item) => item.sentence),
    total: checked.length,
  };
}

function checkLesson({ output, sameLanguage }: { output: string; sameLanguage: boolean }) {
  const lesson = parseLesson(output);

  if (!lesson) {
    return { judgedOutput: output, passed: 0, problems: ["The output isn't a lesson."], total: 1 };
  }

  const orders = checkOrders({ lesson, sameLanguage });
  const definitions = sameLanguage ? checkDefinitions(lesson) : null;

  return {
    judgedOutput: JSON.stringify({
      ...lesson,
      sentences: orders.sentences,
      words: definitions?.words ?? lesson.words,
    }),
    passed: orders.passed + (definitions?.passed ?? 0),
    problems: [...orders.problems, ...(definitions?.problems ?? [])],
    total: orders.total + (definitions?.total ?? 0),
  };
}

export const checkLanguageLessonOutput: TaskCodeChecks = ({ output, testCase }) =>
  checkLesson({ output, sameLanguage: isSameLanguage(testCase.userInput as LanguageLessonInput) });

export const scoreLanguageLesson: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkLanguageLessonOutput({ output: value, testCase }),
    output,
    scoreCategories: LANGUAGE_LESSON_SCORE_CATEGORIES,
    testCase,
  });
