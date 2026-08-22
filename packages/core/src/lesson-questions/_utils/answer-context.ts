import "server-only";
import { type LessonQuestionContextSnapshot } from "@zoonk/ai/tasks/lessons/question";
import { sanitizeDistractors } from "@zoonk/utils/distractors";
import { segmentWords } from "@zoonk/utils/string";
import { checkStepAnswer } from "../../player/contracts/check-step-answer";
import { type SelectedAnswer } from "../../player/contracts/completion-input-schema";
import {
  buildDistractorWordLookup,
  buildTranslationOptions,
  serializeDistractorWord,
} from "../../player/contracts/translation-options";
import { getChapterDistractorWordsForResources } from "../../player/queries/get-chapter-distractor-words";
import { parseStepContent } from "../../steps/contract/content";
import { type LessonQuestionStep } from "./question-step";

const ANSWER_ITEM_SEPARATOR = " → ";

function normalizeAnswerItem(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function getItemCount({ items, value }: { items: string[]; value: string }): number {
  const normalizedValue = normalizeAnswerItem(value);
  return items.filter((item) => normalizeAnswerItem(item) === normalizedValue).length;
}

function isItemMultisetSubset({
  availableItems,
  selectedItems,
}: {
  availableItems: string[];
  selectedItems: string[];
}): boolean {
  const selectedValues = [...new Set(selectedItems.map((item) => normalizeAnswerItem(item)))];

  return selectedValues.every(
    (value) =>
      getItemCount({ items: selectedItems, value }) <=
      getItemCount({ items: availableItems, value }),
  );
}

function isSameItemMultiset({
  availableItems,
  selectedItems,
}: {
  availableItems: string[];
  selectedItems: string[];
}): boolean {
  return (
    availableItems.length === selectedItems.length &&
    isItemMultisetSubset({ availableItems, selectedItems })
  );
}

function getAuthoritativeItem({
  availableItems,
  selectedItem,
}: {
  availableItems: string[];
  selectedItem: string;
}): string | null {
  const normalizedSelectedItem = normalizeAnswerItem(selectedItem);

  return (
    availableItems.find((item) => normalizeAnswerItem(item) === normalizedSelectedItem) ?? null
  );
}

function getAuthoritativeItems({
  availableItems,
  selectedItems,
}: {
  availableItems: string[];
  selectedItems: string[];
}): string[] | null {
  if (!isItemMultisetSubset({ availableItems, selectedItems })) {
    return null;
  }

  return selectedItems.flatMap((selectedItem) => {
    const item = getAuthoritativeItem({ availableItems, selectedItem });
    return item ? [item] : [];
  });
}

function getFillBlankSelectedAnswer({
  answer,
  step,
}: {
  answer: Extract<SelectedAnswer, { kind: "fillBlank" }>;
  step: LessonQuestionStep;
}): string | null {
  const content = parseStepContent("fillBlank", step.content);
  const availableItems = [...content.answers, ...content.distractors];

  const selectedItems = getAuthoritativeItems({
    availableItems,
    selectedItems: answer.userAnswers,
  });

  if (!selectedItems || selectedItems.length !== content.answers.length) {
    return null;
  }

  return selectedItems.join(ANSWER_ITEM_SEPARATOR);
}

function getMatchColumnsSelectedAnswer({
  answer,
  step,
}: {
  answer: Extract<SelectedAnswer, { kind: "matchColumns" }>;
  step: LessonQuestionStep;
}): string | null {
  const content = parseStepContent("matchColumns", step.content);
  const availableLeftItems = content.pairs.map((pair) => pair.left);
  const availableRightItems = content.pairs.map((pair) => pair.right);
  const selectedLeftItems = answer.userPairs.map((pair) => pair.left);
  const selectedRightItems = answer.userPairs.map((pair) => pair.right);

  if (
    !isSameItemMultiset({ availableItems: availableLeftItems, selectedItems: selectedLeftItems }) ||
    !isSameItemMultiset({ availableItems: availableRightItems, selectedItems: selectedRightItems })
  ) {
    return null;
  }

  const selectedPairs = answer.userPairs.flatMap((pair) => {
    const left = getAuthoritativeItem({
      availableItems: availableLeftItems,
      selectedItem: pair.left,
    });

    const right = getAuthoritativeItem({
      availableItems: availableRightItems,
      selectedItem: pair.right,
    });

    return left && right ? [`${left}${ANSWER_ITEM_SEPARATOR}${right}`] : [];
  });

  if (selectedPairs.length !== answer.userPairs.length) {
    return null;
  }

  return `${selectedPairs.join("; ")}; Recorded mistakes: ${answer.mistakes}`;
}

function getMultipleChoiceSelectedAnswer({
  answer,
  step,
}: {
  answer: Extract<SelectedAnswer, { kind: "multipleChoice" }>;
  step: LessonQuestionStep;
}): string | null {
  const content = parseStepContent("multipleChoice", step.content);
  return content.options.find((option) => option.id === answer.selectedOptionId)?.text ?? null;
}

function getSelectImageSelectedAnswer({
  answer,
  step,
}: {
  answer: Extract<SelectedAnswer, { kind: "selectImage" }>;
  step: LessonQuestionStep;
}): string | null {
  const content = parseStepContent("selectImage", step.content);
  return content.options.find((option) => option.id === answer.selectedOptionId)?.prompt ?? null;
}

function getSortOrderSelectedAnswer({
  answer,
  step,
}: {
  answer: Extract<SelectedAnswer, { kind: "sortOrder" }>;
  step: LessonQuestionStep;
}): string | null {
  const content = parseStepContent("sortOrder", step.content);

  if (!isSameItemMultiset({ availableItems: content.items, selectedItems: answer.userOrder })) {
    return null;
  }

  return (
    getAuthoritativeItems({ availableItems: content.items, selectedItems: answer.userOrder })?.join(
      ANSWER_ITEM_SEPARATOR,
    ) ?? null
  );
}

function getArrangeWordsSelectedAnswer({
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

async function getTranslationSelectedAnswer({
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

async function getSelectedAnswer({
  answer,
  step,
}: {
  answer: SelectedAnswer;
  step: LessonQuestionStep;
}): Promise<string | null> {
  if (answer.kind !== step.kind) {
    return null;
  }

  switch (answer.kind) {
    case "fillBlank":
      return getFillBlankSelectedAnswer({ answer, step });
    case "listening":
    case "reading":
      return getArrangeWordsSelectedAnswer({ answer, step });
    case "matchColumns":
      return getMatchColumnsSelectedAnswer({ answer, step });
    case "multipleChoice":
      return getMultipleChoiceSelectedAnswer({ answer, step });
    case "selectImage":
      return getSelectImageSelectedAnswer({ answer, step });
    case "sortOrder":
      return getSortOrderSelectedAnswer({ answer, step });
    case "translation":
      return getTranslationSelectedAnswer({ answer, step });
    default:
      return null;
  }
}

export async function getLessonQuestionAnswer({
  answer,
  step,
}: {
  answer: SelectedAnswer;
  step: LessonQuestionStep;
}): Promise<NonNullable<LessonQuestionContextSnapshot["answer"]> | "invalid"> {
  const result = checkStepAnswer(
    {
      content: step.content,
      kind: step.kind,
      sentence: step.sentence
        ? {
            explanation: step.chapterSentence?.explanation,
            sentence: step.sentence.sentence,
            translation: step.chapterSentence?.translation ?? "",
          }
        : null,
      word: step.word ? { id: step.word.id, word: step.word.word } : null,
    },
    answer,
  );

  if (!result) {
    return "invalid";
  }

  const selectedAnswer = await getSelectedAnswer({ answer, step });

  if (!selectedAnswer) {
    return "invalid";
  }

  return {
    correctAnswer: result.correctAnswer,
    feedback: result.feedback,
    isCorrect: result.isCorrect,
    selectedAnswer,
  };
}
