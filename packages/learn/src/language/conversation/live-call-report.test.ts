import { describe, expect, it } from "vitest";
import {
  NO_REPLY_GAPS,
  type ReplyGapEvent,
  recordReplyGap,
  summarizeReplyGaps,
} from "./live-call-report";

function play(events: ReplyGapEvent[], endedAt: number) {
  return summarizeReplyGaps(
    events.reduce((gaps, event) => recordReplyGap(gaps, event), NO_REPLY_GAPS),
    endedAt,
  );
}

function turn(stoppedAt: number): ReplyGapEvent[] {
  return [
    { at: stoppedAt - 2000, speaking: true, type: "voice", voicedAt: stoppedAt - 2000 },
    { at: stoppedAt + 1000, speaking: false, type: "voice", voicedAt: stoppedAt },
  ];
}

describe(summarizeReplyGaps, () => {
  it("measures each reply from the learner going quiet to the character's next words", () => {
    expect(
      play(
        [
          ...turn(5000),
          { at: 6400, type: "character" },
          { at: 6800, type: "character" },
          ...turn(12_000),
          { at: 16_000, type: "character" },
        ],
        20_000,
      ),
    ).toStrictEqual({
      delegations: 0,
      reply_gap_max_ms: 4000,
      reply_gap_median_ms: 2700,
      slow_replies: 1,
      unanswered_turns: 0,
    });
  });

  it("leaves out a reply the app cued and counts turns nothing answered", () => {
    expect(
      play(
        [
          ...turn(5000),
          { type: "cue" },
          { at: 6000, type: "character" },
          ...turn(12_000),
          ...turn(20_000),
        ],
        30_000,
      ),
    ).toMatchObject({ reply_gap_max_ms: null, slow_replies: 0, unanswered_turns: 2 });
  });

  it("leaves out the answer to a cue sent while the learner was still speaking", () => {
    expect(
      play(
        [
          { at: 10_000, speaking: true, type: "voice", voicedAt: 10_000 },
          { type: "cue" },
          { at: 13_000, speaking: false, type: "voice", voicedAt: 12_000 },
          { at: 16_500, type: "character" },
          ...turn(20_000),
          { at: 21_400, type: "character" },
        ],
        30_000,
      ),
    ).toMatchObject({ reply_gap_max_ms: 1400, slow_replies: 0 });
  });

  it("keeps a short pause inside one turn", () => {
    expect(
      play([...turn(5000), ...turn(7000), { at: 8500, type: "character" }], 10_000),
    ).toMatchObject({ reply_gap_max_ms: 1500, unanswered_turns: 0 });
  });
});
