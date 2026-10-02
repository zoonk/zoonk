"use client";

import { useSessionAction } from "../session/use-session-action";
import { useTodayScreen } from "./today-context";

/**
 * Today's one main action, from its button or Enter: it opens the next block. The server sends
 * "Session Started" when the day's first block starts.
 */
export function useContinueSession() {
  const { actions } = useTodayScreen();

  return useSessionAction({ action: actions.continueSession, enterKey: true });
}
