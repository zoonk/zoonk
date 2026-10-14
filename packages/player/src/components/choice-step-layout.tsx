"use client";

import { type ExerciseImage } from "@zoonk/core/library/steps/contract/language-exercises";
import { TaskAsideContent } from "@zoonk/learn/task-layout";
import {
  PlayerChoiceScene,
  PlayerChoiceSceneContext,
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
  PlayerChoiceScenePrompt,
  PlayerChoiceSceneQuestion,
} from "./player-choice-scene";
import { StepImageView } from "./step-image";

/**
 * A choice question's picture, above its question on a phone and beside it from `lg`, capped in
 * height so the options stay in reach.
 */
function ChoiceStepImage({ image }: { image: ExerciseImage }) {
  return (
    <div
      className="relative h-[40dvh] w-full overflow-hidden rounded-xl"
      data-slot="choice-step-image"
    >
      <StepImageView image={image} />
    </div>
  );
}

/**
 * Shared layout for choice-based language steps: an optional picture and situation, the question
 * and the options, with numeric keyboard shortcuts and toggle-to-unselect. The picture and the
 * situation come first on a phone and sit in the lesson's aside from `lg`, beside the question.
 * Once checked, the options show the right answer and a wrong pick. Each step kind provides a thin
 * wrapper that parses its content and builds the answer shape.
 */
export function ChoiceStepLayout({
  context,
  image,
  isChecked,
  onSelect,
  options,
  question,
  selectedKey,
}: {
  context?: string | null;
  image?: ExerciseImage | null;
  isChecked: boolean;
  onSelect: (key: string) => void;
  options: readonly { isCorrect: boolean; key: string; text: string }[];
  question?: string | null;
  selectedKey: string | null;
}) {
  const handleSelect = (index: number) => {
    const option = options[index];

    if (!option || isChecked) {
      return;
    }

    onSelect(option.key);
  };

  return (
    <PlayerChoiceScene>
      {(image || context) && (
        <TaskAsideContent className="flex flex-col gap-3 lg:gap-4">
          {image && <ChoiceStepImage image={image} />}
          <PlayerChoiceSceneContext>{context}</PlayerChoiceSceneContext>
        </TaskAsideContent>
      )}

      {question && (
        <PlayerChoiceScenePrompt>
          <PlayerChoiceSceneQuestion>{question}</PlayerChoiceSceneQuestion>
        </PlayerChoiceScenePrompt>
      )}

      <PlayerChoiceSceneOptions
        isChecked={isChecked}
        onSelect={handleSelect}
        options={options.map((option) => ({
          content: <PlayerChoiceSceneOptionText>{option.text}</PlayerChoiceSceneOptionText>,
          isCorrect: option.isCorrect,
          key: option.key,
        }))}
        selectedKey={selectedKey}
      />
    </PlayerChoiceScene>
  );
}
