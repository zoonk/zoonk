"use client";

import {
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
} from "../../components/player-choice-scene";
import { LessonRichText } from "./lesson-rich-text";

type ChoiceOption = { id: string; isCorrect: boolean; text: string };

function getResultState({
  isChecked,
  option,
  selectedId,
}: {
  isChecked: boolean;
  option: ChoiceOption;
  selectedId: string | null;
}) {
  if (!isChecked) {
    return null;
  }

  if (option.isCorrect) {
    return "correct" as const;
  }

  return option.id === selectedId ? ("incorrect" as const) : null;
}

/**
 * The options of a check or a guess, with number-key shortcuts. Once checked they lock, the pick
 * and the right option are marked, and the rest fade, so the result reads at a glance.
 */
export function LessonChoiceOptions({
  isChecked,
  isLocked,
  onSelect,
  options,
  selectedId,
}: {
  isChecked: boolean;
  isLocked: boolean;
  onSelect: (optionId: string | null) => void;
  options: readonly ChoiceOption[];
  selectedId: string | null;
}) {
  function handleSelect(index: number) {
    const option = options[index];

    if (!option || isLocked) {
      return;
    }

    onSelect(option.id === selectedId ? null : option.id);
  }

  return (
    <PlayerChoiceSceneOptions
      keyboardEnabled={!isLocked}
      onSelect={handleSelect}
      options={options.map((option) => {
        const resultState = getResultState({ isChecked, option, selectedId });

        return {
          content: (
            <PlayerChoiceSceneOptionText>
              <LessonRichText text={option.text} />
            </PlayerChoiceSceneOptionText>
          ),
          disabled: isLocked,
          isDimmed: isChecked
            ? resultState === null
            : selectedId !== null && selectedId !== option.id,
          isSelected: selectedId === option.id,
          key: option.id,
          resultState,
        };
      })}
    />
  );
}
