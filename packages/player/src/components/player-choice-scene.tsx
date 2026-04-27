"use client";

import { useExtracted } from "next-intl";
import { useOptionKeyboard } from "../use-option-keyboard";
import { useReplaceName } from "../user-name-context";
import { OptionCard } from "./option-card";
import { ContextText, QuestionText } from "./question-text";
import { SectionLabel } from "./section-label";
import { InteractiveStepLayout } from "./step-layouts";

type PlayerChoiceOptionResultState = "correct" | "incorrect";

type PlayerChoiceSceneOption = {
  content: React.ReactNode;
  disabled?: boolean;
  isDimmed?: boolean;
  isSelected: boolean;
  key: string;
  resultState?: PlayerChoiceOptionResultState | null;
};

/**
 * Provides the shared shell for all choice-based scenes.
 *
 * Multiple choice and translation choices need the same centered layout,
 * spacing, and action placement. Keeping that shell here means future layout
 * changes land once for the whole family.
 */
export function PlayerChoiceScene({ children }: { children: React.ReactNode }) {
  return <InteractiveStepLayout data-slot="player-choice-scene">{children}</InteractiveStepLayout>;
}

/**
 * Keeps prompt copy grouped consistently above the option list.
 *
 * Some scenes show an eyebrow, some show context, some show only a question.
 * This wrapper gives all of them the same vertical rhythm.
 */
export function PlayerChoiceScenePrompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:gap-6" data-slot="player-choice-scene-prompt">
      {children}
    </div>
  );
}

/**
 * Reuses the shared eyebrow styling for choice scenes that need a short label
 * above the question.
 */
export function PlayerChoiceSceneEyebrow({ children }: { children: React.ReactNode }) {
  return <SectionLabel>{children}</SectionLabel>;
}

/**
 * Replaces the player-name placeholder before rendering contextual copy.
 *
 * Choice scenes often reuse authored text that may contain the learner's name,
 * so the replacement logic needs to stay in the shared scene layer rather than
 * being repeated in every adapter component.
 */
export function PlayerChoiceSceneContext({ children }: { children?: string | null }) {
  const replaceName = useReplaceName();

  if (!children) {
    return null;
  }

  return <ContextText>{replaceName(children)}</ContextText>;
}

/**
 * Replaces the player-name placeholder before rendering the main question.
 *
 * This keeps multiple-choice and translation prompts aligned on the same copy
 * treatment even though they come from different step kinds.
 */
export function PlayerChoiceSceneQuestion({ children }: { children?: string | null }) {
  const replaceName = useReplaceName();

  if (!children) {
    return null;
  }

  return <QuestionText>{replaceName(children)}</QuestionText>;
}

/**
 * Keeps the primary option copy consistent across all choice scenes.
 *
 * Multiple choice and translation choices all present one tappable answer
 * label. Centralizing that text treatment here prevents each adapter from
 * quietly diverging when option typography changes in the future.
 */
export function PlayerChoiceSceneOptionText({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-base leading-6" data-slot="player-choice-scene-option-text">
      {children}
    </span>
  );
}

/**
 * Renders the shared option list and owns the numeric keyboard shortcuts.
 *
 * This exists so the option-card layout, radiogroup semantics, and keyboard
 * interaction cannot drift between multiple-choice and translation adapters.
 */
export function PlayerChoiceSceneOptions({
  ariaLabel,
  keyboardEnabled = true,
  onSelect,
  options,
}: {
  ariaLabel?: string;
  keyboardEnabled?: boolean;
  onSelect: (index: number) => void;
  options: readonly PlayerChoiceSceneOption[];
}) {
  const t = useExtracted();

  useOptionKeyboard({
    enabled: keyboardEnabled,
    onSelect,
    optionCount: options.length,
  });

  return (
    <div
      aria-label={ariaLabel ?? t("Answer options")}
      className="flex flex-col gap-3"
      data-slot="player-choice-scene-options"
      role="radiogroup"
    >
      {options.map((option, index) => (
        <OptionCard
          disabled={option.disabled}
          index={index}
          isDimmed={option.isDimmed}
          isSelected={option.isSelected}
          key={option.key}
          onSelect={() => onSelect(index)}
          resultState={option.resultState ?? null}
        >
          {option.content}
        </OptionCard>
      ))}
    </div>
  );
}
