"use client";

import { type LanguageConversationSetup } from "@zoonk/core/language/conversations/contract";
import {
  LIVE_CALL_SILENCE_CUE,
  LIVE_CALL_WRAP_UP_CUE,
  formatOpeningCue,
} from "@zoonk/core/language/conversations/live-call-cues";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendLiveCallCue } from "./live-call-commands";
import { type LiveCallSession } from "./live-call-session";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
/** The character starts wrapping up this long before the call's time is over. */
const WRAP_UP_SECONDS = 20;
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

/**
 * When a connected call's own length ends, on this device's clock (the time the server said was
 * left, from when its answer arrived), and the plan's call time it reaches by then, if any.
 */
export type CallLength = { endsAt: number } & Pick<LanguageConversationSetup, "endsAtLimit">;

/** What the app tells the voice model when the call has run this long, as an examiner keeps time. */
type TimedCue = { atSeconds: number; say: string };

const NO_CUES: readonly TimedCue[] = [];

/**
 * The call's clock while it's live. It runs until the call's length ends as the server's deadline
 * fixed it (`startClock`), so the time spent connecting is already gone and nothing starts it over;
 * the limit shown is what's left of it when the call went live, less than the call's length when
 * it reaches the plan's call time. Near the end the character wraps up, and when that's the plan's
 * call time running out, today's or this month's, `limitNear` says which; at the end the call ends
 * on its own, when the server hangs it up too. A learner quiet for a while (nothing said or
 * typed, `markLearnerActive` marks both) is asked once whether they're there, and the call ends if
 * they stay quiet: the voice session is paid by the second, silence included. An exam task's `cues`
 * go out once each when the call has run that long (the examiner moving to the questions).
 */
export function useCallClock({
  cues = NO_CUES,
  hangUp,
  minutes,
  session,
}: {
  cues?: readonly TimedCue[];
  hangUp: () => void;
  minutes: number;
  session: LiveCallSession | null;
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [length, setLength] = useState<CallLength | null>(null);
  const [now, setNow] = useState(0);
  const wrappedUp = useRef(false);
  const lastLearnerAt = useRef(0);
  const nudged = useRef(false);
  const cuesSent = useRef(0);
  const endsAt = length?.endsAt ?? null;

  const limitSeconds =
    endsAt === null || startedAt === null
      ? minutes * SECONDS_PER_MINUTE
      : Math.max(0, Math.round((endsAt - startedAt) / MS_PER_SECOND));

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
    if (!session || startedAt === null || endsAt === null) {
      return;
    }

    const timer = setInterval(() => {
      const tick = Date.now();
      const elapsed = (tick - startedAt) / MS_PER_SECOND;
      const quiet = (tick - lastLearnerAt.current) / MS_PER_SECOND;
      setNow(tick);

      const cue = cues[cuesSent.current];

      if (cue && !wrappedUp.current && elapsed >= cue.atSeconds) {
        cuesSent.current += 1;
        sendLiveCallCue({ content: cue.say, session });
      }

      if (!wrappedUp.current && tick >= endsAt - WRAP_UP_SECONDS * MS_PER_SECOND) {
        wrappedUp.current = true;
        sendLiveCallCue({ content: LIVE_CALL_WRAP_UP_CUE, session });
      }

      if (!nudged.current && !wrappedUp.current && quiet >= SILENCE_NUDGE_SECONDS) {
        nudged.current = true;
        sendLiveCallCue({ content: LIVE_CALL_SILENCE_CUE, session });
      }

      if (tick >= endsAt || quiet >= SILENCE_END_SECONDS) {
        hangUp();
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [cues, endsAt, hangUp, session, startedAt]);

  const elapsedSeconds = startedAt === null ? 0 : Math.floor((now - startedAt) / MS_PER_SECOND);
  const wrappingUp = endsAt !== null && now >= endsAt - WRAP_UP_SECONDS * MS_PER_SECOND;

  return {
    elapsedSeconds,
    limitNear: wrappingUp ? (length?.endsAtLimit ?? null) : null,
    limitSeconds,
    markLearnerActive,
    startClock,
  };
}
