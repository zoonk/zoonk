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
