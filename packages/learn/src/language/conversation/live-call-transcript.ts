import { type ConversationTurn } from "@zoonk/core/language/conversations/contract";
import {
  MAX_CONVERSATION_TURNS,
  MAX_CONVERSATION_TURN_LENGTH,
} from "@zoonk/core/language/conversations/turn-limits";

export type TranscriptTurn = ConversationTurn & { endMs: number | null; startMs: number | null };

type TranscriptFragment = {
  delta: string;
  endMs: number;
  speaker: ConversationTurn["speaker"];
  startMs: number;
};

const UTTERANCE_PAUSE_MS = 1000;

/**
 * Fragments carry their own spaces, so they're appended as received, except the first of words
 * said after a pause, which comes without one.
 */
export function addTranscriptFragment(
  turns: readonly TranscriptTurn[],
  fragment: TranscriptFragment,
): TranscriptTurn[] {
  const last = turns.at(-1);

  if (last?.speaker === fragment.speaker && last.startMs !== null) {
    const paused = last.endMs !== null && fragment.startMs - last.endMs >= UTTERANCE_PAUSE_MS;
    const spaced = /\s$/u.test(last.text) || /^\s/u.test(fragment.delta);
    const text = `${last.text}${paused && !spaced ? " " : ""}${fragment.delta}`;
    return [...turns.slice(0, -1), { ...last, endMs: fragment.endMs, text }];
  }

  return [
    ...turns,
    {
      endMs: fragment.endMs,
      speaker: fragment.speaker,
      startMs: fragment.startMs,
      text: fragment.delta,
    },
  ];
}

export function addTypedReply(turns: readonly TranscriptTurn[], text: string): TranscriptTurn[] {
  return [...turns, { endMs: null, speaker: "learner", startMs: null, text }];
}

export function getSpokenMs(turns: readonly TranscriptTurn[]): number {
  return turns
    .filter((turn) => turn.speaker === "learner")
    .reduce(
      (total, turn) =>
        turn.startMs === null || turn.endMs === null ? total : total + turn.endMs - turn.startMs,
      0,
    );
}

export function toConversationTurns(turns: readonly TranscriptTurn[]): ConversationTurn[] {
  return turns
    .map((turn) => ({
      speaker: turn.speaker,
      text: turn.text.trim().slice(0, MAX_CONVERSATION_TURN_LENGTH),
    }))
    .filter((turn) => turn.text.length > 0)
    .slice(-MAX_CONVERSATION_TURNS);
}
