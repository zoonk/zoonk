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
const WRAP_UP_SECONDS = 20;
const SILENCE_NUDGE_SECONDS = 20;
const SILENCE_END_SECONDS = 45;
const TICK_MS = 500;
const OPENING_RETRY_MS = 5000;

/** GPT-Live only speaks first when told to, so the call opens with a cue, sent once more if the character stays silent. */
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

/** `endsAt` is on this device's clock: the time the server said was left, from when its answer arrived. */
export type CallLength = { endsAt: number } & Pick<LanguageConversationSetup, "endsAtLimit">;

type TimedCue = { atSeconds: number; say: string };

const NO_CUES: readonly TimedCue[] = [];

/** A quiet learner is asked once whether they're there, then the call ends: the voice session is paid by the second, silence included. */
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
