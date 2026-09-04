import { type SelectedAnswer } from "../../player/contracts/completion-input-schema";
import { parseStepContent } from "../../steps/contract/content";
import { type LessonQuestionStep } from "./question-step";
import {
  ANSWER_ITEM_SEPARATOR,
  getAuthoritativeItem,
  isSameItemMultiset,
} from "./selected-answer-items";

export function getMatchColumnsSelectedAnswer({
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
