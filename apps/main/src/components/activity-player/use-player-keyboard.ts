"use client";

import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { type PlayerPhase } from "./player-reducer";

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
}: {
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
}) {
  useKeyboardCallback(
    "Enter",
    () => {
      if (phase === "intro" && onStartChallenge) {
        onStartChallenge();
      } else if (phase === "playing" && hasAnswer) {
        onCheck();
      } else if (phase === "feedback") {
        onContinue();
      } else if (phase === "completed") {
        if (onNext) {
          onNext();
        } else {
          onEscape();
        }
      }
    },
    { mode: "none" },
  );

  useKeyboardCallback(
    "r",
    () => {
      if (phase === "completed") {
        onRestart();
      }
    },
    { ignoreEditable: true, mode: "none" },
  );

  useKeyboardCallback(
    "ArrowRight",
    () => {
      if (phase === "playing" && isStaticStep) {
        onNavigateNext();
      }
    },
    { mode: "none" },
  );

  useKeyboardCallback(
    "ArrowLeft",
    () => {
      if (phase === "playing" && isStaticStep) {
        onNavigatePrev();
      }
    },
    { mode: "none" },
  );

  useKeyboardCallback("Escape", onEscape, { mode: "none" });
}
