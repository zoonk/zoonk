"use client";

import { type ExerciseImage } from "@zoonk/core/library/steps/contract/language-exercises";
import {
  PlayerChoiceScene,
  PlayerChoiceSceneContext,
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
  PlayerChoiceScenePrompt,
  PlayerChoiceSceneQuestion,
} from "./player-choice-scene";
import { StepImageView } from "./step-image";

/** A choice question's picture, above its question, capped in height so the options stay in reach. */
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
 * situation come first, right above the question, on every screen size. Once checked, the options
 * show the right answer and a wrong pick. Each step kind provides a thin wrapper that parses its
 * content and builds the answer shape.
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
  return (
    <PlayerChoiceScene>
      {(image || context) && (
        <div className="flex flex-col gap-3 lg:gap-4">
          {image && <ChoiceStepImage image={image} />}
          <PlayerChoiceSceneContext>{context}</PlayerChoiceSceneContext>
        </div>
      )}

      {question && (
        <PlayerChoiceScenePrompt>
          <PlayerChoiceSceneQuestion>{question}</PlayerChoiceSceneQuestion>
        </PlayerChoiceScenePrompt>
      )}

      <PlayerChoiceSceneOptions
        isChecked={isChecked}
        onSelect={onSelect}
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
