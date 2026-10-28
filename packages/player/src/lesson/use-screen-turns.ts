"use client";

import { useState } from "react";
import { useLessonPlayer } from "./lesson-player-context";
import { useLessonInteraction } from "./lesson-player-interaction";
import { type LessonPlayerState } from "./lesson-player-state";

export type ScreenTurn = "back" | "forward";

type SeenScreen = { position: number; queue: readonly string[]; turn: ScreenTurn | null };

export function useScreenTurns(): { back: () => boolean; forward: () => boolean } {
  const { actions, screen } = useLessonPlayer();
  const { isPaused } = useLessonInteraction();

  return {
    back: () => {
      if (isPaused || !screen.canGoBack) {
        return false;
      }

      actions.goBack();
      return true;
    },
    forward: () => {
      if (isPaused || !screen.canGoForward) {
        return false;
      }

      actions.continue();
      return true;
    },
  };
}

/** Call where the lesson stays mounted across screen changes. */
export function useScreenTurn(state: LessonPlayerState): ScreenTurn | null {
  const [seen, setSeen] = useState<SeenScreen>({
    position: state.position,
    queue: state.queue,
    turn: null,
  });

  if (seen.position === state.position) {
    if (seen.queue !== state.queue) {
      setSeen({ ...seen, queue: state.queue });
    }

    return seen.turn;
  }

  const isBack = seen.queue === state.queue && state.position === seen.position - 1;
  const turn: ScreenTurn = isBack ? "back" : "forward";

  setSeen({ position: state.position, queue: state.queue, turn });
  return turn;
}
