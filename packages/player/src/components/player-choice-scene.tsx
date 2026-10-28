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

export function PlayerChoiceScene({ children }: { children: React.ReactNode }) {
  return <InteractiveStepLayout data-slot="player-choice-scene">{children}</InteractiveStepLayout>;
}

export function PlayerChoiceScenePrompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3" data-slot="player-choice-scene-prompt">
      {children}
    </div>
  );
}

export function PlayerChoiceSceneContext({ children }: { children?: string | null }) {
  if (!children) {
    return null;
  }

  return <ContextText>{children}</ContextText>;
}

export function PlayerChoiceSceneQuestion({ children }: { children?: string | null }) {
  if (!children) {
    return null;
  }

  return <QuestionText>{children}</QuestionText>;
}

export function PlayerChoiceSceneOptionText({ children }: { children: React.ReactNode }) {
  return (
    <span data-slot="player-choice-scene-option-text">
      {typeof children === "string" ? <PlayerRichText text={children} /> : children}
    </span>
  );
}

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
  isGuess?: boolean;
  isLocked?: boolean;
  keepsEveryOption?: boolean;
  layout?: "grid" | "list";
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
