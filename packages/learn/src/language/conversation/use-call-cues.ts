"use client";

import { type LanguageConversationSetup } from "@zoonk/core/language/conversations/contract";
import {
  LIVE_CALL_SILENCE_CUE,
  LIVE_CALL_WRAP_UP_CUE,
  formatOpeningCue,
} from "@zoonk/core/language/conversations/live-call-cues";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type LiveCallSession, sendLiveCallCue } from "./live-call-session";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
/** The character starts wrapping up this long before the call's time is over. */
const WRAP_UP_SECONDS = 20;
/**
 * Room for the goodbye before the call ends on its own: the voice session is paid by the second,
 * so a call shown as two minutes lasts about two.
 */
const GRACE_SECONDS = 10;
/** The learner quiet this long (no word said or typed): the character asks if they're there. */
const SILENCE_NUDGE_SECONDS = 20;
/** Still quiet this long after their last word, the call ends on its own and shows its feedback. */
const SILENCE_END_SECONDS = 45;
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

/** How long a connected call may run, as the server set it when the call connected. */
type CallLength = Pick<LanguageConversationSetup, "endsAtLimit" | "seconds">;

/**
 * The call's clock while it's live. It runs for the call's length, or for what the server let it
 * run when it connected (`startClock`), which is less when it reaches the plan's call time. Near
 * the end the character wraps up, and when that's the plan's call time running out, today's or this
 * month's, `limitNear` says which; just after the end the call ends on its own. A learner quiet for a while (nothing said
 * or typed, `markLearnerActive` marks both) is asked once whether they're there, and the call ends
 * if they stay quiet: the voice session is paid by the second, silence included.
 */
export function useCallClock({
  hangUp,
  minutes,
  session,
}: {
  hangUp: () => void;
  minutes: number;
  session: LiveCallSession | null;
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [length, setLength] = useState<CallLength | null>(null);
  const [now, setNow] = useState(0);
  const [wrappingUp, setWrappingUp] = useState(false);
  const wrappedUp = useRef(false);
  const lastLearnerAt = useRef(0);
  const nudged = useRef(false);
  const limitSeconds = length?.seconds ?? minutes * SECONDS_PER_MINUTE;

  const startClock = useCallback((connected: CallLength) => {
    const connectedAt = Date.now();
    lastLearnerAt.current = connectedAt;
    setLength(connected);
    setStartedAt(connectedAt);
    setNow(connectedAt);
  }, []);

  const markLearnerActive = useCallback(() => {
    lastLearnerAt.current = Date.now();
    nudged.current = false;
  }, []);

  useEffect(() => {
    if (!session || startedAt === null) {
      return;
    }

    const timer = setInterval(() => {
      const tick = Date.now();
      const elapsed = (tick - startedAt) / MS_PER_SECOND;
      const quiet = (tick - lastLearnerAt.current) / MS_PER_SECOND;
      setNow(tick);

      if (!wrappedUp.current && elapsed >= limitSeconds - WRAP_UP_SECONDS) {
        wrappedUp.current = true;
        setWrappingUp(true);
        sendLiveCallCue({ content: LIVE_CALL_WRAP_UP_CUE, session });
      }

      if (!nudged.current && !wrappedUp.current && quiet >= SILENCE_NUDGE_SECONDS) {
        nudged.current = true;
        sendLiveCallCue({ content: LIVE_CALL_SILENCE_CUE, session });
      }

      if (elapsed >= limitSeconds + GRACE_SECONDS || quiet >= SILENCE_END_SECONDS) {
        hangUp();
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [hangUp, limitSeconds, session, startedAt]);

  const elapsedSeconds = startedAt === null ? 0 : Math.floor((now - startedAt) / MS_PER_SECOND);

  return {
    elapsedSeconds,
    limitNear: wrappingUp ? (length?.endsAtLimit ?? null) : null,
    limitSeconds,
    markLearnerActive,
    startClock,
  };
}
