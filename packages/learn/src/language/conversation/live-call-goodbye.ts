/**
 * The goodbye cue the call's ending sent, and whether the character has started saying it: the
 * first words after the cue took its place on the session's timeline.
 */
export type GoodbyeRequest = {
  /** Where the first acknowledged cue took its place on the session's timeline, if it says. */
  acknowledged: { startMs: number | null } | null;
  /** The latest start of the character's words heard after the cue went out, before its ack. */
  heardStartMs: number | null;
  ids: string[];
  sentAt: number;
};

/**
 * Measured over WebRTC: a cue's answer began 200 ms before its acknowledgment's `start_ms` and
 * arrived before the acknowledgment did. Words from before the cue started at least
 * `characterQuietMs` earlier, since the cue waits for the character to be quiet that long.
 */
const GOODBYE_LEAD_MS = 500;

function startsGoodbye({ startMs: cueMs }: { startMs: number | null }, startMs: number) {
  return cueMs === null || startMs >= cueMs - GOODBYE_LEAD_MS;
}

/** A first request, or the one retry: either cue's acknowledgment counts. */
export function requestGoodbye(goodbye: GoodbyeRequest | null, at: number): GoodbyeRequest {
  const id = `goodbye-${(goodbye?.ids.length ?? 0) + 1}`;

  return goodbye
    ? { ...goodbye, ids: [...goodbye.ids, id] }
    : { acknowledged: null, heardStartMs: null, ids: [id], sentAt: at };
}

export function hearGoodbye(goodbye: GoodbyeRequest, startMs: number) {
  if (goodbye.acknowledged) {
    return { goodbye, said: startsGoodbye(goodbye.acknowledged, startMs) };
  }

  const heardStartMs = Math.max(goodbye.heardStartMs ?? startMs, startMs);
  return { goodbye: { ...goodbye, heardStartMs }, said: false };
}

export function acknowledgeGoodbye(
  goodbye: GoodbyeRequest,
  { id, startMs }: { id: string; startMs: number | null },
) {
  if (goodbye.acknowledged || !goodbye.ids.includes(id)) {
    return { goodbye, said: false };
  }

  return {
    goodbye: { ...goodbye, acknowledged: { startMs } },
    said: goodbye.heardStartMs !== null && startsGoodbye({ startMs }, goodbye.heardStartMs),
  };
}
