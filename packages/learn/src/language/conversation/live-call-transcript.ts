import {
  type ConversationTurn,
  MAX_CONVERSATION_TURNS,
  MAX_CONVERSATION_TURN_LENGTH,
} from "@zoonk/core/language/conversations/contract";

const MS_PER_SECOND = 1000;

/**
 * One turn of a live call as it builds up: GPT-Live sends each speaker's transcript in fragments,
 * with where each one falls on the session's timeline. A typed reply has no timeline.
 */
export type TranscriptTurn = ConversationTurn & { endMs: number | null; startMs: number | null };

type TranscriptFragment = {
  delta: string;
  endMs: number;
  speaker: ConversationTurn["speaker"];
  startMs: number;
};

/**
 * Adds a fragment to the speaker's turn when they spoke last, or starts their next turn. Fragments
 * are appended exactly as received, since they carry their own spaces.
 */
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

/** A reply the learner typed: a turn of its own. */
export function addTypedReply(turns: readonly TranscriptTurn[], text: string): TranscriptTurn[] {
  return [...turns, { endMs: null, speaker: "learner", startMs: null, text }];
}

/** How long the learner spoke: each spoken turn from its first word to its last. */
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

/** The turns as the app saves and checks them: trimmed, without empty ones, within the limits. */
export function toConversationTurns(turns: readonly TranscriptTurn[]): ConversationTurn[] {
  return turns
    .map((turn) => ({
      speaker: turn.speaker,
      text: turn.text.trim().slice(0, MAX_CONVERSATION_TURN_LENGTH),
    }))
    .filter((turn) => turn.text.length > 0)
    .slice(0, MAX_CONVERSATION_TURNS);
}
