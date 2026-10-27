"use client";

import { AnswerOption, AnswerOptionGroup } from "@zoonk/learn/answer-option";
import { type AnswerOptionResult } from "@zoonk/learn/answer-tone";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { usePlayerInteractionState } from "../player-context";
import { getNumberKeyShortcut } from "../player-shortcuts";
import { PlayerRichText } from "./player-rich-text";
import { ContextText, QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";

type PlayerChoiceSceneOption = { content: React.ReactNode; isCorrect: boolean; key: string };

/**
 * Once checked, the right option says so, and the learner's pick says it was theirs if wrong. A
 * guess that missed (a hook's "Guess first") is never a mistake: the pick stays neutral.
 */
function getOptionResult({
  isChecked,
  isCorrect,
  isGuess,
  isPicked,
}: {
  isChecked: boolean;
  isCorrect: boolean;
  isGuess: boolean;
  isPicked: boolean;
}): AnswerOptionResult | null {
  if (!isChecked) {
    return null;
  }

  if (isCorrect) {
    return "right";
  }

  if (!isPicked) {
    return null;
  }

  return isGuess ? "guess" : "wrong";
}

/**
 * Provides the shared shell for all choice-based scenes.
 *
 * Multiple choice and translation choices need the same top-aligned layout,
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
    <div className="flex flex-col gap-3" data-slot="player-choice-scene-prompt">
      {children}
    </div>
  );
}

/** The situation before a choice question, when it has one. */
export function PlayerChoiceSceneContext({ children }: { children?: string | null }) {
  if (!children) {
    return null;
  }

  return <ContextText>{children}</ContextText>;
}

/** A choice question's line, when it has one. */
export function PlayerChoiceSceneQuestion({ children }: { children?: string | null }) {
  if (!children) {
    return null;
  }

  return <QuestionText>{children}</QuestionText>;
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
    <span data-slot="player-choice-scene-option-text">
      {typeof children === "string" ? <PlayerRichText text={children} /> : children}
    </span>
  );
}

/**
 * The answers of every choice question in the player (a check, a guess, a picture question, an
 * activity's question, a language lesson's multiple choice and translation), as the kit's
 * `AnswerOption`: numbered, picked with a tap or its number key. Once checked they lock, and only
 * the right answer and a wrong pick stay, marked "Correct" and "Your answer", so the question, both
 * answers and the result fit on a phone's screen without scrolling. A guess keeps every option, since
 * its reveal answers the question the learner just read and nothing in it was wrong, and so does
 * `keepsEveryOption`, where each option explains itself after the check.
 */
export function PlayerChoiceSceneOptions({
  ariaLabel,
  isChecked = false,
  isGuess = false,
  isLocked = false,
  keepsEveryOption = false,
  layout = "list",
  onSelect,
  options,
  selectedKey,
}: {
  ariaLabel?: string;
  isChecked?: boolean;
  /** A guess that never counts (a hook's "Guess first"): a missed pick says "Your guess", not wrong. */
  isGuess?: boolean;
  /** The answer is being graded or the screen waits on something: options can't be picked. */
  isLocked?: boolean;
  keepsEveryOption?: boolean;
  /** `grid` lays picture options out side by side, two to a row. */
  layout?: "grid" | "list";
  /** The option pressed or picked by its number key, by its key. */
  onSelect: (key: string) => void;
  options: readonly PlayerChoiceSceneOption[];
  selectedKey: string | null;
}) {
  const t = useExtracted();
  const interactionState = usePlayerInteractionState();
  const isDisabled = isLocked || isChecked;

  useNumberKeys({
    count: options.length,
    enabled: !isDisabled && interactionState !== "paused",
    onPick: (index) => {
      const option = options[index];

      if (option) {
        onSelect(option.key);
      }
    },
  });

  return (
    <AnswerOptionGroup
      aria-label={ariaLabel ?? t("Answer options")}
      className={cn(layout === "grid" && "grid grid-cols-2 gap-3")}
      data-slot="player-choice-scene-options"
    >
      {options.map((option, index) => {
        const isPicked = selectedKey === option.key;

        const result = getOptionResult({
          isChecked,
          isCorrect: option.isCorrect,
          isGuess,
          isPicked,
        });

        if (isChecked && !result && !keepsEveryOption && !isGuess) {
          return null;
        }

        return (
          <AnswerOption
            aria-keyshortcuts={getNumberKeyShortcut(index) ?? undefined}
            disabled={isDisabled}
            key={option.key}
            layout={layout === "grid" ? "stacked" : "row"}
            marker={index + 1}
            onClick={() => onSelect(option.key)}
            picked={isPicked}
            result={result}
          >
            {option.content}
          </AnswerOption>
        );
      })}
    </AnswerOptionGroup>
  );
}
