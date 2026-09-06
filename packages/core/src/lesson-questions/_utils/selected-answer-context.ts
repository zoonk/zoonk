import "server-only";
import { type SelectedAnswer } from "../../player/contracts/completion-input-schema";
import { parseStepContent } from "../../steps/contract/content";
import {
  getArrangeWordsSelectedAnswer,
  getTranslationSelectedAnswer,
} from "./language-answer-context";
import { getMatchColumnsSelectedAnswer } from "./match-columns-answer-context";
import { type LessonQuestionStep } from "./question-step";
import {
  ANSWER_ITEM_SEPARATOR,
  getAuthoritativeItems,
  isSameItemMultiset,
} from "./selected-answer-items";

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

export async function getSelectedAnswer({
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
