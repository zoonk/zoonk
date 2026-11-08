"use client";

import { useState } from "react";
import { turnKeepingFocus } from "./_utils/lesson-focus";
import { useLessonPlayer } from "./lesson-player-context";
import { useLessonInteraction } from "./lesson-player-interaction";
import { type LessonPlayerState } from "./lesson-player-state";

export type ScreenTurn = "back" | "forward";

type SeenScreen = { position: number; queue: readonly string[]; turn: ScreenTurn | null };

function run(turn: () => void): void {
  turn();
}

/** `keepFocus`: keys move a focused Previous or main button's focus to the next screen's; taps and swipes don't. */
export function useScreenTurns({ keepFocus = false }: { keepFocus?: boolean } = {}): {
  back: () => boolean;
  forward: () => boolean;
} {
  const { actions, screen } = useLessonPlayer();
  const { isPaused } = useLessonInteraction();
  const turn = keepFocus ? turnKeepingFocus : run;

  return {
    back: () => {
      if (isPaused || !screen.canGoBack) {
        return false;
      }

      turn(actions.goBack);
      return true;
    },
    forward: () => {
      if (isPaused || !screen.canGoForward) {
        return false;
      }

      turn(actions.continue);
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
