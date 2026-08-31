import { type SelectedAnswer } from "../../player/contracts/completion-input-schema";
import { parseStepContent } from "../../steps/contract/content";
import { type LessonQuestionStep } from "./question-step";
import {
  ANSWER_ITEM_SEPARATOR,
  getAuthoritativeItem,
  isSameItemMultiset,
  normalizeAnswerItem,
} from "./selected-answer-items";

function getIncorrectMatchColumnsAnswer({
  availableLeftItems,
  availableRightItems,
  correctPairs,
  incorrectPair,
}: {
  availableLeftItems: string[];
  availableRightItems: string[];
  correctPairs: { left: string; right: string }[];
  incorrectPair: { left: string; right: string };
}): string | null {
  const left = getAuthoritativeItem({
    availableItems: availableLeftItems,
    selectedItem: incorrectPair.left,
  });

  const right = getAuthoritativeItem({
    availableItems: availableRightItems,
    selectedItem: incorrectPair.right,
  });

  if (!left || !right) {
    return null;
  }

  const isCorrectPair = correctPairs.some(
    (pair) =>
      normalizeAnswerItem(pair.left) === normalizeAnswerItem(left) &&
      normalizeAnswerItem(pair.right) === normalizeAnswerItem(right),
  );

  return isCorrectPair ? null : `${left}${ANSWER_ITEM_SEPARATOR}${right}`;
}

function hasConsistentMatchMistakeContext(
  answer: Extract<SelectedAnswer, { kind: "matchColumns" }>,
): boolean {
  return answer.mistakes === 0 ? !answer.incorrectPair : Boolean(answer.incorrectPair);
}

export function getMatchColumnsSelectedAnswer({
  answer,
  step,
}: {
  answer: Extract<SelectedAnswer, { kind: "matchColumns" }>;
  step: LessonQuestionStep;
}): string | null {
  if (!hasConsistentMatchMistakeContext(answer)) {
    return null;
  }

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

  if (answer.incorrectPair) {
    const incorrectPair = getIncorrectMatchColumnsAnswer({
      availableLeftItems,
      availableRightItems,
      correctPairs: content.pairs,
      incorrectPair: answer.incorrectPair,
    });

    if (!incorrectPair) {
      return null;
    }

    return `${incorrectPair}; Recorded mistakes: ${answer.mistakes}`;
  }

  return selectedPairs.join("; ");
}
