"use client";

import { useEffect } from "react";
import { type PlayerPhase } from "./player-reducer";

export function usePlayerKeyboard({
  phase,
  hasAnswer,
  isStaticStep,
  onCheck,
  onContinue,
  onNavigateNext,
  onNavigatePrev,
}: {
  phase: PlayerPhase;
  hasAnswer: boolean;
  isStaticStep: boolean;
  onCheck: () => void;
  onContinue: () => void;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
}) {
  useEffect(() => {
    function hasModifier(event: KeyboardEvent) {
      return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    }

    function handleEnter() {
      if (phase === "playing" && hasAnswer) {
        onCheck();
      } else if (phase === "feedback") {
        onContinue();
      }
    }

    function handleArrows(key: string) {
      if (phase !== "playing" || !isStaticStep) {
        return;
      }

      if (key === "ArrowRight") {
        onNavigateNext();
      } else if (key === "ArrowLeft") {
        onNavigatePrev();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (hasModifier(event)) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        handleEnter();
      }

      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        handleArrows(event.key);
      }
    }

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [phase, hasAnswer, isStaticStep, onCheck, onContinue, onNavigateNext, onNavigatePrev]);
}
