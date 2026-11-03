"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import { type RefObject, useCallback, useMemo, useRef } from "react";
import { useLearnAnalytics } from "../../learn-context";
import { type CallHangUpReason } from "./live-call-ending";
import {
  NO_REPLY_GAPS,
  type ReplyGapEvent,
  recordReplyGap,
  summarizeReplyGaps,
} from "./live-call-report";
import { type TranscriptTurn, toConversationTurns } from "./live-call-transcript";

const MS_PER_SECOND = 1000;

export type CallReport = ReturnType<typeof useCallReport>;

export type CallEndReason = CallHangUpReason | "dropped" | "failed" | "learnerEnded";

const REASONS = {
  done: "done",
  dropped: "dropped",
  failed: "failed",
  goodbye: "goodbye",
  hardStop: "hard_stop",
  learnerEnded: "learner_ended",
  quiet: "quiet",
  time: "time",
} as const satisfies Record<CallEndReason, string>;

const KINDS = {
  checkpoint: "checkpoint",
  examSpeaking: "exam_speaking",
  practice: "practice",
  speakingMock: "speaking_mock",
} as const satisfies Record<LanguageConversationView["kind"], string>;

/**
 * One best-effort "Call Ended" per connection, however it ended, so dropped and failed calls
 * count too. A call refused before it was reserved had no connection and sends nothing.
 */
export function useCallReport({
  kind,
  turnsRef,
}: {
  kind: LanguageConversationView["kind"];
  turnsRef: RefObject<TranscriptTurn[]>;
}) {
  const analytics = useLearnAnalytics();
  const gaps = useRef(NO_REPLY_GAPS);
  const call = useRef<{ liveAt: number | null; talkSeconds: number } | null>(null);
  const sent = useRef(false);

  const record = useCallback((event: ReplyGapEvent) => {
    gaps.current = recordReplyGap(gaps.current, event);
  }, []);

  const reserved = useCallback((talkSeconds: number) => {
    call.current = { liveAt: null, talkSeconds };
  }, []);

  const live = useCallback(() => {
    if (call.current) {
      call.current.liveAt = Date.now();
    }
  }, []);

  const send = useCallback(
    (reason: CallEndReason) => {
      const current = call.current;

      if (!current || sent.current) {
        return;
      }

      sent.current = true;
      const at = Date.now();
      const turns = toConversationTurns(turnsRef.current);

      analytics.track({
        name: "Call Ended",
        properties: {
          conversation_kind: KINDS[kind],
          duration_seconds:
            current.liveAt === null ? 0 : Math.round((at - current.liveAt) / MS_PER_SECOND),
          learner_turns: turns.filter((turn) => turn.speaker === "learner").length,
          reason: REASONS[reason],
          talk_seconds: current.talkSeconds,
          ...summarizeReplyGaps(gaps.current),
        },
      });
    },
    [analytics, kind, turnsRef],
  );

  return useMemo(() => ({ live, record, reserved, send }), [live, record, reserved, send]);
}
