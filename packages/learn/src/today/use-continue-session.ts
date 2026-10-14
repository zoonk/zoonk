"use client";

import { useSessionAction } from "../session/use-session-action";
import { useTodayScreen } from "./today-context";

/**
 * Today's one main action, from its button or Enter (`enterKey`, while the day has a block to go
 * on with): it opens the next block. The server sends "Session Started" when the day's first block
 * starts.
 */
export function useContinueSession({ enterKey }: { enterKey: boolean }) {
  const { actions } = useTodayScreen();

  return useSessionAction({ action: actions.continueSession, enterKey });
}
