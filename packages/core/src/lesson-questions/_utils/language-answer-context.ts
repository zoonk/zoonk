import "server-only";
import { sanitizeDistractors } from "@zoonk/utils/distractors";
import { segmentWords } from "@zoonk/utils/string";
import { type SelectedAnswer } from "../../player/contracts/completion-input-schema";
import {
  buildDistractorWordLookup,
  buildTranslationOptions,
  serializeDistractorWord,
} from "../../player/contracts/translation-options";
import { getChapterDistractorWordsForResources } from "../../player/queries/get-chapter-distractor-words";
import { type LessonQuestionStep } from "./question-step";
import { getAuthoritativeItems } from "./selected-answer-items";

export function getArrangeWordsSelectedAnswer({
  answer,
  step,
}: {
  answer: Extract<SelectedAnswer, { kind: "listening" | "reading" }>;
  step: LessonQuestionStep;
}): string | null {
  if (!step.sentence || !step.chapterSentence) {
    return null;
  }

  const isReading = answer.kind === "reading";
  const canonicalText = isReading ? step.sentence.sentence : step.chapterSentence.translation;

  const rawDistractors = isReading
    ? step.chapterSentence.distractors
    : step.chapterSentence.translationDistractors;

  const canonicalItems = segmentWords(canonicalText);

  const distractors = sanitizeDistractors({
    distractors: rawDistractors,
    input: canonicalText,
    shape: "single-word",
  }).map((distractor) => distractor.toLocaleLowerCase());

  const selectedItems = getAuthoritativeItems({
    availableItems: [...canonicalItems, ...distractors],
    selectedItems: answer.arrangedWords,
  });

  if (!selectedItems || selectedItems.length !== canonicalItems.length) {
    return null;
  }

  return selectedItems.join(" ");
}

export async function getTranslationSelectedAnswer({
  answer,
  step,
}: {
  answer: Extract<SelectedAnswer, { kind: "translation" }>;
  step: LessonQuestionStep;
}): Promise<string | null> {
  if (!step.word || !step.chapterWord) {
    return null;
  }

  const distractorWords = await getChapterDistractorWordsForResources({
    chapterSentences: [],
    chapterWords: [{ ...step.chapterWord, word: step.word }],
  });

  const serializedDistractors = distractorWords.map((word) =>
    serializeDistractorWord({
      ...word,
      pronunciation: word.pronunciations[0]?.pronunciation ?? null,
    }),
  );

  const options = buildTranslationOptions({
    distractorLookup: buildDistractorWordLookup(serializedDistractors),
    kind: step.kind,
    word: {
      audioUrl: step.word.audioUrl,
      distractors: step.chapterWord.distractors,
      id: step.word.id,
      pronunciation:
        step.word.pronunciations.find(
          (pronunciation) => pronunciation.userLanguage === step.chapterWord?.userLanguage,
        )?.pronunciation ?? null,
      romanization: step.word.romanization,
      translation: step.chapterWord.translation,
      word: step.word.word,
    },
  });

  return options.find((option) => option.id === answer.selectedOptionId)?.word ?? null;
}
