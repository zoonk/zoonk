"use client";

import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { type PlayerKeyboardModel } from "./player-screen";

type PlayerKeyboardParams = {
  keyboard: PlayerKeyboardModel;
  onCheck: () => void;
  onContinue: () => void;
  onEscape: () => void;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onNext: (() => void) | null;
  onRestart: () => void;
};

/**
 * Keyboard behavior is derived from the shared screen model. This helper maps
 * those declarative action identifiers back to the live callbacks exposed by
 * the provider so Enter and arrow keys stay aligned with the current screen.
 */
function runKeyboardAction({
  action,
  onCheck,
  onContinue,
  onEscape,
  onNavigateNext,
  onNavigatePrev,
  onNext,
}: {
  action:
    | PlayerKeyboardModel["enterAction"]
    | PlayerKeyboardModel["leftAction"]
    | PlayerKeyboardModel["rightAction"];
} & Pick<
  PlayerKeyboardParams,
  "onCheck" | "onContinue" | "onEscape" | "onNavigateNext" | "onNavigatePrev" | "onNext"
>) {
  if (!action) {
    return false;
  }

  switch (action) {
    case "check":
      onCheck();
      return;
    case "continue":
      onContinue();
      return;
    case "navigateNext":
      onNavigateNext();
      return;
    case "navigatePrev":
      onNavigatePrev();
      return;
    case "nextOrEscape":
      (onNext ?? onEscape)();
      return;
    default:
      return false;
  }
}

export function usePlayerKeyboard({
  keyboard,
  onCheck,
  onContinue,
  onEscape,
  onNavigateNext,
  onNavigatePrev,
  onNext,
  onRestart,
}: PlayerKeyboardParams) {
  useKeyboardCallback(
    "Enter",
    () =>
      runKeyboardAction({
        action: keyboard.enterAction,
        onCheck,
        onContinue,
        onEscape,
        onNavigateNext,
        onNavigatePrev,
        onNext,
      }),
    { mode: "none" },
  );

  useKeyboardCallback(
    "r",
    () => {
      if (!keyboard.canRestart) {
        return false;
      }

      onRestart();
    },
    { ignoreEditable: true, mode: "none" },
  );

  useKeyboardCallback(
    "ArrowRight",
    () =>
      runKeyboardAction({
        action: keyboard.rightAction,
        onCheck,
        onContinue,
        onEscape,
        onNavigateNext,
        onNavigatePrev,
        onNext,
      }),
    { mode: "none" },
  );

  useKeyboardCallback(
    "ArrowLeft",
    () =>
      runKeyboardAction({
        action: keyboard.leftAction,
        onCheck,
        onContinue,
        onEscape,
        onNavigateNext,
        onNavigatePrev,
        onNext,
      }),
    { mode: "none" },
  );

  useKeyboardCallback("Escape", () => onEscape(), { mode: "none" });
}
