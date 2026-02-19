"use client";

import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { type PlayerPhase } from "./player-reducer";

type PlayerKeyboardParams = {
  hasAnswer: boolean;
  isStaticStep: boolean;
  onCheck: () => void;
  onContinue: () => void;
  onEscape: () => void;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onNext: (() => void) | null;
  onRestart: () => void;
  onStartChallenge: (() => void) | null;
  phase: PlayerPhase;
};

function getEnterAction({
  hasAnswer,
  onCheck,
  onContinue,
  onEscape,
  onNext,
  onStartChallenge,
  phase,
}: Pick<
  PlayerKeyboardParams,
  "hasAnswer" | "onCheck" | "onContinue" | "onEscape" | "onNext" | "onStartChallenge" | "phase"
>): (() => void) | null {
  if (phase === "intro" && onStartChallenge) {
    return onStartChallenge;
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
  hasAnswer,
  isStaticStep,
  onCheck,
  onContinue,
  onEscape,
  onNavigateNext,
  onNavigatePrev,
  onNext,
  onRestart,
  onStartChallenge,
  phase,
}: PlayerKeyboardParams) {
  useKeyboardCallback(
    "Enter",
    (event) => {
      const action = getEnterAction({
        hasAnswer,
        onCheck,
        onContinue,
        onEscape,
        onNext,
        onStartChallenge,
        phase,
      });

      if (action) {
        event.preventDefault();
        action();
      }
    },
    { mode: "none" },
  );

  useKeyboardCallback(
    "r",
    (event) => {
      if (phase === "completed") {
        event.preventDefault();
        onRestart();
      }
    },
    { ignoreEditable: true, mode: "none" },
  );

  useKeyboardCallback(
    "ArrowRight",
    (event) => {
      if (phase === "playing" && isStaticStep) {
        event.preventDefault();
        onNavigateNext();
      }
    },
    { mode: "none" },
  );

  useKeyboardCallback(
    "ArrowLeft",
    (event) => {
      if (phase === "playing" && isStaticStep) {
        event.preventDefault();
        onNavigatePrev();
      }
    },
    { mode: "none" },
  );

  useKeyboardCallback("Escape", () => onEscape(), { mode: "none" });
}
