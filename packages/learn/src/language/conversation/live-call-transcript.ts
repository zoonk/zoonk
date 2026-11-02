import { type ConversationTurn } from "@zoonk/core/language/conversations/contract";
import {
  MAX_CONVERSATION_TURNS,
  MAX_CONVERSATION_TURN_LENGTH,
} from "@zoonk/core/language/conversations/turn-limits";

const MS_PER_SECOND = 1000;

export type TranscriptTurn = ConversationTurn & { endMs: number | null; startMs: number | null };

type TranscriptFragment = {
  delta: string;
  endMs: number;
  speaker: ConversationTurn["speaker"];
  startMs: number;
};

/** Fragments carry their own spaces, so they're appended exactly as received. */
export function addTranscriptFragment(
  turns: readonly TranscriptTurn[],
  fragment: TranscriptFragment,
): TranscriptTurn[] {
  const last = turns.at(-1);

  if (last?.speaker === fragment.speaker && last.startMs !== null) {
    return [
      ...turns.slice(0, -1),
      { ...last, endMs: fragment.endMs, text: `${last.text}${fragment.delta}` },
    ];
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

export function getSpokenSeconds(turns: readonly TranscriptTurn[]): number {
  const spokenMs = turns
    .filter((turn) => turn.speaker === "learner")
    .reduce(
      (total, turn) =>
        turn.startMs === null || turn.endMs === null ? total : total + turn.endMs - turn.startMs,
      0,
    );

  return Math.round(spokenMs / MS_PER_SECOND);
}

export function toConversationTurns(turns: readonly TranscriptTurn[]): ConversationTurn[] {
  return turns
    .map((turn) => ({
      speaker: turn.speaker,
      text: turn.text.trim().slice(0, MAX_CONVERSATION_TURN_LENGTH),
    }))
    .filter((turn) => turn.text.length > 0)
    .slice(0, MAX_CONVERSATION_TURNS);
}
