/**
 * How long the learner waited for the character, as a proxy: from their microphone last hearing
 * them to the character's next transcript arriving, not to audible speech. A pause shorter than a
 * slow reply is the learner thinking, so it stays one turn.
 */

const SLOW_REPLY_MS = 3000;

/** Words that come sooner were said over the learner, as on Android. */
const OVERLAP_MS = 400;

export type ReplyGaps = {
  /** An app cue went out the character hasn't answered yet: its next words answer the cue. */
  cued: boolean;
  delegations: number;
  gaps: number[];
  unanswered: number;
  /** When the microphone last heard the learner, until the character answers it. */
  voicedAt: number | null;
};

export type ReplyGapEvent =
  /** A microphone sample that heard the learner. */
  | { at: number; type: "voice" }
  | { at: number; type: "character" }
  | { type: "cue" }
  | { type: "delegation" };

export const NO_REPLY_GAPS: ReplyGaps = {
  cued: false,
  delegations: 0,
  gaps: [],
  unanswered: 0,
  voicedAt: null,
};

function hearVoice(gaps: ReplyGaps, at: number): ReplyGaps {
  const unanswered = gaps.voicedAt !== null && at - gaps.voicedAt > SLOW_REPLY_MS;
  return { ...gaps, unanswered: gaps.unanswered + (unanswered ? 1 : 0), voicedAt: at };
}

function hearCharacter(gaps: ReplyGaps, at: number): ReplyGaps {
  const { voicedAt } = gaps;

  if (voicedAt === null) {
    return { ...gaps, cued: false };
  }

  if (at - voicedAt < OVERLAP_MS) {
    return gaps;
  }

  const answered = gaps.cued ? gaps.gaps : [...gaps.gaps, at - voicedAt];
  return { ...gaps, cued: false, gaps: answered, voicedAt: null };
}

export function recordReplyGap(gaps: ReplyGaps, event: ReplyGapEvent): ReplyGaps {
  if (event.type === "voice") {
    return hearVoice(gaps, event.at);
  }

  if (event.type === "delegation") {
    return { ...gaps, delegations: gaps.delegations + 1 };
  }

  if (event.type === "cue") {
    return { ...gaps, cued: true };
  }

  return hearCharacter(gaps, event.at);
}

/** A turn still waiting for its answer when the call ended counts as unanswered. */
export function summarizeReplyGaps(gaps: ReplyGaps) {
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
    unanswered_turns: gaps.unanswered + (gaps.voicedAt === null ? 0 : 1),
  };
}
