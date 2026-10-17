"use client";

import { useState } from "react";
import { useLessonPlayer } from "./lesson-player-context";
import { useLessonInteraction } from "./lesson-player-interaction";
import { type LessonPlayerState } from "./lesson-player-state";

export type ScreenTurn = "back" | "forward";

type SeenScreen = { position: number; queue: readonly string[]; turn: ScreenTurn | null };

/**
 * Turning screens without the main action: the arrow keys on a keyboard and a swipe on a touch
 * screen. Forward reads on (Next on a reading screen), back returns a screen; both wait while a
 * sheet is open. Each returns whether it turned, so a key it didn't use stays the page's.
 */
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

/**
 * Which way the learner just turned: back when the same lesson moved one screen earlier (Previous,
 * the left arrow or a swipe right), forward for every other new screen, null on the first one.
 * Read where the lesson stays mounted from screen to screen, since each screen remounts below it.
 */
export function useScreenTurn(state: LessonPlayerState): ScreenTurn | null {
  const [seen, setSeen] = useState<SeenScreen>({
    position: state.position,
    queue: state.queue,
    turn: null,
  });

  if (seen.position === state.position) {
    // A missed question joining the end of the lesson isn't a turn: the screen stays as it is.
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
