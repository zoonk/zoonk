"use client";

import { useEffect, useEffectEvent } from "react";
import { type PlayerQuestionSupport } from "./player-context";

function isEditableTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return false;
}

export function useOptionKeyboard({
  enabled,
  interactionState,
  onSelect,
  optionCount,
}: {
  enabled: boolean;
  interactionState: PlayerQuestionSupport["interactionState"];
  onSelect: (index: number) => void;
  optionCount: number;
}) {
  const handleSelect = useEffectEvent((index: number) => {
    onSelect(index);
  });

  useEffect(() => {
    if (!enabled || interactionState === "paused") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      const digit = Number(event.key);

      if (!Number.isInteger(digit) || digit < 1 || digit > optionCount) {
        return;
      }

      handleSelect(digit - 1);
    }

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [enabled, interactionState, optionCount]);
}
