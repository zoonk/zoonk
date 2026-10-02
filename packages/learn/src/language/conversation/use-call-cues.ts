"use client";

import {
  LIVE_CALL_WRAP_UP_CUE,
  formatOpeningCue,
} from "@zoonk/core/language/conversations/live-call-cues";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type LiveCallSession, sendLiveCallCue } from "./live-call-session";

const MS_PER_SECOND = 1000;
/** The character starts wrapping up this long before the call's time is over. */
const WRAP_UP_SECONDS = 15;
/** Room for the goodbye before the call ends on its own. */
const GRACE_SECONDS = 30;
const TICK_MS = 500;
/** GPT-Live usually opens within a second; still silent after this, it's told again once. */
const OPENING_RETRY_MS = 5000;

/**
 * Opens the call right after `session.started`: GPT-Live only speaks first when told to. If the
 * character hasn't said a word a few seconds later, the cue goes out once more. `cancel` stops the
 * retry once the character talks.
 */
export function useOpeningCue(openingLine: string) {
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (retry.current) {
      clearTimeout(retry.current);
      retry.current = null;
    }
  }, []);

  const open = useCallback(
    (session: LiveCallSession) => {
      const content = formatOpeningCue(openingLine);
      sendLiveCallCue({ content, session });

      retry.current = setTimeout(() => {
        retry.current = null;
        sendLiveCallCue({ content, session });
      }, OPENING_RETRY_MS);
    },
    [openingLine],
  );

  useEffect(() => cancel, [cancel]);

  return useMemo(() => ({ cancel, open }), [cancel, open]);
}

/**
 * The call's clock while it's live: near its length the character wraps up, and a while after it
 * the call ends on its own.
 */
export function useCallClock({
  hangUp,
  limitSeconds,
  session,
}: {
  hangUp: () => void;
  limitSeconds: number;
  session: LiveCallSession | null;
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const wrappedUp = useRef(false);

  const startClock = useCallback(() => {
    const connectedAt = Date.now();
    setStartedAt(connectedAt);
    setNow(connectedAt);
  }, []);

  useEffect(() => {
    if (!session || startedAt === null) {
      return;
    }

    const timer = setInterval(() => {
      const tick = Date.now();
      const elapsed = (tick - startedAt) / MS_PER_SECOND;
      setNow(tick);

      if (!wrappedUp.current && elapsed >= limitSeconds - WRAP_UP_SECONDS) {
        wrappedUp.current = true;
        sendLiveCallCue({ content: LIVE_CALL_WRAP_UP_CUE, session });
      }

      if (elapsed >= limitSeconds + GRACE_SECONDS) {
        hangUp();
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [hangUp, limitSeconds, session, startedAt]);

  const elapsedSeconds = startedAt === null ? 0 : Math.floor((now - startedAt) / MS_PER_SECOND);

  return { elapsedSeconds, startClock };
}
