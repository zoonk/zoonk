/**
 * How long the learner waited for the character, as a proxy: from their microphone going quiet to
 * the character's next transcript arriving, not to audible speech. A pause shorter than a slow
 * reply is the learner thinking, so it stays one turn.
 */

const SLOW_REPLY_MS = 3000;

export type ReplyGaps = {
  /** An app cue went out in this turn: the character's next words answer it, not only them. */
  cued: boolean;
  delegations: number;
  gaps: number[];
  speaking: boolean;
  stoppedAt: number | null;
  unanswered: number;
};

export type ReplyGapEvent =
  | { at: number; speaking: boolean; type: "voice"; voicedAt: number | null }
  | { at: number; type: "character" }
  | { type: "cue" }
  | { type: "delegation" };

export const NO_REPLY_GAPS: ReplyGaps = {
  cued: false,
  delegations: 0,
  gaps: [],
  speaking: false,
  stoppedAt: null,
  unanswered: 0,
};

function isUnanswered(gaps: ReplyGaps, at: number) {
  return gaps.stoppedAt !== null && at - gaps.stoppedAt > SLOW_REPLY_MS;
}

function hearVoice(gaps: ReplyGaps, event: Extract<ReplyGapEvent, { type: "voice" }>): ReplyGaps {
  if (event.speaking === gaps.speaking) {
    return gaps;
  }

  if (event.speaking) {
    const unanswered = gaps.unanswered + (isUnanswered(gaps, event.at) ? 1 : 0);
    // Speaking again after a pause is the same turn, which keeps a cue sent during it.
    const cued = gaps.stoppedAt !== null && gaps.cued;
    return { ...gaps, cued, speaking: true, stoppedAt: null, unanswered };
  }

  return { ...gaps, speaking: false, stoppedAt: event.voicedAt ?? event.at };
}

export function recordReplyGap(gaps: ReplyGaps, event: ReplyGapEvent): ReplyGaps {
  if (event.type === "voice") {
    return hearVoice(gaps, event);
  }

  if (event.type === "delegation") {
    return { ...gaps, delegations: gaps.delegations + 1 };
  }

  if (event.type === "cue") {
    return { ...gaps, cued: true };
  }

  if (gaps.stoppedAt === null) {
    return { ...gaps, cued: false };
  }

  const answered = gaps.cued ? gaps.gaps : [...gaps.gaps, event.at - gaps.stoppedAt];
  return { ...gaps, cued: false, gaps: answered, stoppedAt: null };
}

export function summarizeReplyGaps(gaps: ReplyGaps, endedAt: number) {
  const sorted = gaps.gaps.toSorted((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);

  const median =
    sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);

  return {
    delegations: gaps.delegations,
    reply_gap_max_ms: sorted.at(-1) ?? null,
    reply_gap_median_ms: sorted.length > 0 ? Math.round(median) : null,
    slow_replies: sorted.filter((gap) => gap > SLOW_REPLY_MS).length,
    unanswered_turns: gaps.unanswered + (isUnanswered(gaps, endedAt) ? 1 : 0),
  };
}
