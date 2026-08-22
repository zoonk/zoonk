"use client";

import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { type PlayerQuestionSupport } from "./player-context";
import { type PlayerKeyboardModel } from "./player-screen";

type PlayerKeyboardParams = {
  interactionState: PlayerQuestionSupport["interactionState"];
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
  "onCheck" | "onContinue" | "onNavigateNext" | "onNavigatePrev" | "onNext"
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
    case "next":
      if (!onNext) {
        return false;
      }

      onNext();
      return;
    default:
      return false;
  }
}

export function usePlayerKeyboard({
  interactionState,
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
    () => {
      if (interactionState === "paused") {
        return false;
      }

      return runKeyboardAction({
        action: keyboard.enterAction,
        onCheck,
        onContinue,
        onNavigateNext,
        onNavigatePrev,
        onNext,
      });
    },
    { mode: "none" },
  );

  useKeyboardCallback(
    "r",
    () => {
      if (interactionState === "paused" || !keyboard.canRestart) {
        return false;
      }

      onRestart();
    },
    { ignoreEditable: true, mode: "none" },
  );

  useKeyboardCallback(
    "ArrowRight",
    () => {
      if (interactionState === "paused") {
        return false;
      }

      return runKeyboardAction({
        action: keyboard.rightAction,
        onCheck,
        onContinue,
        onNavigateNext,
        onNavigatePrev,
        onNext,
      });
    },
    { mode: "none" },
  );

  useKeyboardCallback(
    "ArrowLeft",
    () => {
      if (interactionState === "paused") {
        return false;
      }

      return runKeyboardAction({
        action: keyboard.leftAction,
        onCheck,
        onContinue,
        onNavigateNext,
        onNavigatePrev,
        onNext,
      });
    },
    { mode: "none" },
  );

  useKeyboardCallback(
    "Escape",
    () => {
      if (interactionState === "paused") {
        return false;
      }

      onEscape();
    },
    { mode: "none" },
  );
}
