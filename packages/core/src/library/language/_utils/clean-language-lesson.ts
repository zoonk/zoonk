import { type LanguageLessonContent } from "@zoonk/ai/tasks/v2/language/language-lesson";
import { normalizeDistractorKey, sanitizeDistractors } from "@zoonk/utils/distractors";
import { normalizePunctuation, segmentWords } from "@zoonk/utils/string";

const BLANK = "[BLANK]";

/** The most right answers a typed answer step accepts. */
const MAX_ACCEPTED_ANSWERS = 5;

function cleanText(text: string): string {
  return normalizePunctuation(text).trim();
}

function cleanOptional(text: string | null): string | null {
  const cleaned = text ? cleanText(text) : "";
  return cleaned || null;
}

function uniqueBy<TItem>(items: readonly TItem[], getKey: (item: TItem) => string): TItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getKey(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function toWordKeys(text: string): Set<string> {
  return new Set(segmentWords(text).map((word) => normalizeDistractorKey(word)));
}

/** A wrong option must never be one of the words the answer itself is made of. */
function withoutWordsOf({ distractors, text }: { distractors: string[]; text: string }): string[] {
  const keys = toWordKeys(text);

  return sanitizeDistractors({ distractors, input: text }).filter(
    (distractor) => !keys.has(normalizeDistractorKey(distractor)),
  );
}

function cleanWords({
  content,
  knownWords,
}: {
  content: LanguageLessonContent;
  knownWords: readonly string[];
}): LanguageLessonContent["words"] {
  const known = new Set(knownWords.map((word) => normalizeDistractorKey(word)));

  const words = uniqueBy(
    content.words.map((word) => ({
      ...word,
      translation: cleanText(word.translation),
      word: cleanText(word.word),
    })),
    (word) => normalizeDistractorKey(word.word),
  ).filter((word) => word.translation && !known.has(normalizeDistractorKey(word.word)));

  const lessonKeys = new Set(words.map((word) => normalizeDistractorKey(word.word)));

  return words.map((word) => ({
    ...word,
    distractors: sanitizeDistractors({
      distractors: word.distractors,
      input: word.word,
      shape: "any",
    }).filter((distractor) => !lessonKeys.has(normalizeDistractorKey(distractor))),
    note: cleanOptional(word.note),
    pronunciation: cleanText(word.pronunciation),
    romanization: cleanOptional(word.romanization),
    tip: cleanOptional(word.tip),
  }));
}

function cleanSentences(content: LanguageLessonContent): LanguageLessonContent["sentences"] {
  const sentences = content.sentences.map((sentence) => ({
    ...sentence,
    explanation: cleanText(sentence.explanation),
    sentence: cleanText(sentence.sentence),
    translation: cleanText(sentence.translation),
  }));

  return uniqueBy(sentences, (sentence) => normalizeDistractorKey(sentence.sentence))
    .filter((sentence) => sentence.translation && sentence.explanation)
    .map((sentence) => ({
      ...sentence,
      distractors: withoutWordsOf({ distractors: sentence.distractors, text: sentence.sentence }),
      romanization: cleanOptional(sentence.romanization),
      speakingPrompt: cleanOptional(sentence.speakingPrompt),
      translationDistractors: withoutWordsOf({
        distractors: sentence.translationDistractors,
        text: sentence.translation,
      }),
    }));
}

/** A blank that isn't there, or a "wrong" option that is the answer, makes an unanswerable question. */
function cleanPractice(content: LanguageLessonContent): LanguageLessonContent["practice"] {
  return content.practice
    .map((item) => ({
      ...item,
      answer: cleanText(item.answer),
      distractors: sanitizeDistractors({
        distractors: item.distractors,
        input: item.answer,
        shape: "any",
      }),
      feedback: cleanText(item.feedback),
      question: cleanOptional(item.question),
      template: cleanText(item.template),
    }))
    .filter(
      (item) =>
        item.answer &&
        item.feedback &&
        item.distractors.length > 0 &&
        item.template.split(BLANK).length === 2,
    );
}

function cleanWriting(content: LanguageLessonContent): LanguageLessonContent["writing"] {
  const answers = uniqueBy(content.writing.answers.map(cleanText), (answer) =>
    normalizeDistractorKey(answer),
  );

  return {
    answers: answers.slice(0, MAX_ACCEPTED_ANSWERS),
    keyPoints: content.writing.keyPoints.map(cleanText).filter(Boolean),
    prompt: cleanText(content.writing.prompt),
  };
}

/**
 * Code repairs what a model gets subtly wrong before anything is stored:
 * whitespace before punctuation, repeated words or sentences, words the unit
 * already taught, wrong options that are really right, and practice questions
 * without exactly one blank. Items that can't be repaired are dropped.
 */
export function cleanLanguageLesson({
  content,
  knownWords,
}: {
  content: LanguageLessonContent;
  knownWords: readonly string[];
}): LanguageLessonContent {
  return {
    practice: cleanPractice(content),
    sentences: cleanSentences(content),
    summary: content.summary.map(cleanText).filter(Boolean),
    tip: {
      examples: content.tip.examples.map((example) => ({
        sentence: cleanText(example.sentence),
        translation: cleanText(example.translation),
      })),
      text: cleanText(content.tip.text),
      title: cleanText(content.tip.title),
    },
    words: cleanWords({ content, knownWords }),
    writing: cleanWriting(content),
  };
}
