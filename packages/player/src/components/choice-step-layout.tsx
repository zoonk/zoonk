"use client";

import {
  PlayerChoiceScene,
  PlayerChoiceSceneContext,
  PlayerChoiceSceneOptions,
  PlayerChoiceScenePrompt,
  PlayerChoiceSceneQuestion,
} from "./player-choice-scene";

/**
 * Shared layout for choice-based steps (multiple choice, story decisions).
 *
 * Owns all rendering and interaction: text display, option list with dimming,
 * keyboard shortcuts (1/2/3), and toggle-to-unselect. Each step kind provides
 * a thin wrapper that parses its content and builds the answer shape.
 */
export function ChoiceStepLayout({
  context,
  onSelect,
  options,
  question,
  selectedIndex,
}: {
  context?: string | null;
  onSelect: (index: number) => void;
  options: readonly { key: string; text: string }[];
  question?: string | null;
  selectedIndex: number | null;
}) {
  const hasSelection = selectedIndex !== null;

  return (
    <PlayerChoiceScene>
      {(context || question) && (
        <PlayerChoiceScenePrompt>
          <PlayerChoiceSceneContext>{context}</PlayerChoiceSceneContext>
          <PlayerChoiceSceneQuestion>{question}</PlayerChoiceSceneQuestion>
        </PlayerChoiceScenePrompt>
      )}

      <PlayerChoiceSceneOptions
        onSelect={onSelect}
        options={options.map((option, index) => ({
          content: <span className="text-base leading-6">{option.text}</span>,
          isDimmed: hasSelection && selectedIndex !== index,
          isSelected: selectedIndex === index,
          key: option.key,
        }))}
      />
    </PlayerChoiceScene>
  );
}
