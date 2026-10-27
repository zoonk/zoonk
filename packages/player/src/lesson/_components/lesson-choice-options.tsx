"use client";

import {
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
} from "../../components/player-choice-scene";
import { LessonRichText } from "./lesson-rich-text";

type ChoiceOption = { id: string; isCorrect: boolean; text: string };

/**
 * The options of a check or a guess, with number-key shortcuts. Once checked they lock and only
 * the right option and a wrong pick stay, marked, so the result reads at a glance; a guess's pick
 * stays neutral, since a guess is never wrong.
 */
export function LessonChoiceOptions({
  isChecked,
  isGuess = false,
  isLocked,
  onSelect,
  options,
  selectedId,
}: {
  isChecked: boolean;
  isGuess?: boolean;
  isLocked: boolean;
  onSelect: (optionId: string | null) => void;
  options: readonly ChoiceOption[];
  selectedId: string | null;
}) {
  return (
    <PlayerChoiceSceneOptions
      isChecked={isChecked}
      isGuess={isGuess}
      isLocked={isLocked}
      onSelect={(id) => onSelect(id === selectedId ? null : id)}
      options={options.map((option) => ({
        content: (
          <PlayerChoiceSceneOptionText>
            <LessonRichText text={option.text} />
          </PlayerChoiceSceneOptionText>
        ),
        isCorrect: option.isCorrect,
        key: option.id,
      }))}
      selectedKey={selectedId}
    />
  );
}
