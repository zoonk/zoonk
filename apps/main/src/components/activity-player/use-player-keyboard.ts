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
  phase,
}: {
  hasAnswer: boolean;
  isStaticStep: boolean;
  onCheck: () => void;
  onContinue: () => void;
  onEscape: () => void;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  phase: PlayerPhase;
}) {
  useKeyboardCallback(
    "Enter",
    () => {
      if (phase === "playing" && hasAnswer) {
        onCheck();
      } else if (phase === "feedback") {
        onContinue();
      }
    },
    { mode: "none" },
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
