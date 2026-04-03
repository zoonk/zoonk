"use client";

import { type StoryStaticVariant } from "@zoonk/core/steps/contract/content";
import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { type PlayerPhase } from "./player-reducer";

type PlayerKeyboardParams = {
  canNavigatePrev: boolean;
  hasAnswer: boolean;
  isStaticStep: boolean;
  onCheck: () => void;
  onContinue: () => void;
  onEscape: () => void;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onNext: (() => void) | null;
  onRestart: () => void;
  phase: PlayerPhase;
  storyStaticVariant: StoryStaticVariant | null;
};

function getEnterAction({
  hasAnswer,
  onCheck,
  onContinue,
  onEscape,
  onNavigateNext,
  onNext,
  phase,
  storyStaticVariant,
}: Pick<
  PlayerKeyboardParams,
  | "hasAnswer"
  | "onCheck"
  | "onContinue"
  | "onEscape"
  | "onNavigateNext"
  | "onNext"
  | "phase"
  | "storyStaticVariant"
>): (() => void) | null {
  if (phase === "playing" && storyStaticVariant) {
    return onNavigateNext;
  }

  if (phase === "playing" && hasAnswer) {
    return onCheck;
  }

  if (phase === "feedback") {
    return onContinue;
  }

  if (phase === "completed") {
    return onNext ?? onEscape;
  }

  return null;
}

export function usePlayerKeyboard({
  canNavigatePrev,
  hasAnswer,
  isStaticStep,
  onCheck,
  onContinue,
  onEscape,
  onNavigateNext,
  onNavigatePrev,
  onNext,
  onRestart,
  phase,
  storyStaticVariant,
}: PlayerKeyboardParams) {
  useKeyboardCallback(
    "Enter",
    () => {
      const action = getEnterAction({
        hasAnswer,
        onCheck,
        onContinue,
        onEscape,
        onNavigateNext,
        onNext,
        phase,
        storyStaticVariant,
      });

      if (!action) {
        return false;
      }
      action();
    },
    { mode: "none" },
  );

  useKeyboardCallback(
    "r",
    () => {
      if (phase !== "completed") {
        return false;
      }
      onRestart();
    },
    { ignoreEditable: true, mode: "none" },
  );

  useKeyboardCallback(
    "ArrowRight",
    () => {
      if (phase !== "playing" || !isStaticStep) {
        return false;
      }
      onNavigateNext();
    },
    { mode: "none" },
  );

  useKeyboardCallback(
    "ArrowLeft",
    () => {
      if (phase !== "playing" || !canNavigatePrev) {
        return false;
      }
      onNavigatePrev();
    },
    { mode: "none" },
  );

  useKeyboardCallback("Escape", () => onEscape(), { mode: "none" });
}
