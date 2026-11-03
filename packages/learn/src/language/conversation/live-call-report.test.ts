import { describe, expect, it } from "vitest";
import {
  NO_REPLY_GAPS,
  type ReplyGapEvent,
  recordReplyGap,
  summarizeReplyGaps,
} from "./live-call-report";

function play(events: ReplyGapEvent[]) {
  return summarizeReplyGaps(
    events.reduce((gaps, event) => recordReplyGap(gaps, event), NO_REPLY_GAPS),
  );
}

/** The microphone hears the learner every 100 ms until `stoppedAt`. */
function turn(stoppedAt: number, ms = 2000): ReplyGapEvent[] {
  return Array.from({ length: ms / 100 + 1 }, (_, index) => ({
    at: stoppedAt - ms + index * 100,
    type: "voice",
  }));
}

describe(summarizeReplyGaps, () => {
  it("measures each reply from the learner going quiet to the character's next words", () => {
    expect(
      play([
        ...turn(5000),
        { at: 6400, type: "character" },
        { at: 6800, type: "character" },
        ...turn(12_000),
        { at: 16_000, type: "character" },
      ]),
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
      play([
        ...turn(5000),
        { type: "cue" },
        { at: 6000, type: "character" },
        ...turn(12_000),
        ...turn(20_000),
      ]),
    ).toMatchObject({ reply_gap_max_ms: null, slow_replies: 0, unanswered_turns: 2 });
  });

  it("leaves out the answer to a cue sent while the learner was still speaking", () => {
    expect(
      play([
        ...turn(11_000, 1000),
        { type: "cue" },
        ...turn(12_000, 1000),
        { at: 16_500, type: "character" },
        ...turn(20_000),
        { at: 21_400, type: "character" },
      ]),
    ).toMatchObject({ reply_gap_max_ms: 1400, slow_replies: 0 });
  });

  it("keeps a cue's answer out after the learner paused and spoke again", () => {
    expect(
      play([
        ...turn(20_000),
        { type: "cue" },
        ...turn(25_000, 1000),
        { at: 29_000, type: "character" },
      ]),
    ).toMatchObject({ reply_gap_max_ms: null, slow_replies: 0, unanswered_turns: 1 });
  });

  it("measures a reply that came while the microphone's hangover still held the voice", () => {
    expect(play([...turn(2000), { at: 2600, type: "character" }])).toMatchObject({
      reply_gap_max_ms: 600,
      unanswered_turns: 0,
    });
  });

  it("doesn't take words said over the learner for their answer", () => {
    expect(
      play([...turn(2000), { at: 2100, type: "character" }, { at: 2900, type: "character" }]),
    ).toMatchObject({ reply_gap_max_ms: 900, unanswered_turns: 0 });
  });

  it("counts a turn the hang-up cut off as unanswered", () => {
    expect(play(turn(9800))).toMatchObject({ unanswered_turns: 1 });
  });

  it("keeps a short pause inside one turn", () => {
    expect(play([...turn(5000), ...turn(7000), { at: 8500, type: "character" }])).toMatchObject({
      reply_gap_max_ms: 1500,
      unanswered_turns: 0,
    });
  });
});
