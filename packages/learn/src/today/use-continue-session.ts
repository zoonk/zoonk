"use client";

import { useSessionAction } from "../session/use-session-action";
import { useTodayScreen } from "./today-context";

/** The server sends "Session Started". A step Start links to (`continueHref`) takes Enter on its link instead, so one key never both requests and follows it. */
export function useContinueSession({ enterKey }: { enterKey: boolean }) {
  const { actions } = useTodayScreen();

  return useSessionAction({
    action: actions.continueSession,
    enterKey: enterKey && !actions.continueHref,
  });
}
