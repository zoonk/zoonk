import { describe, expect, it } from "vitest";
import { carryCallSoFar, startCallOver } from "./live-call-so-far";
import {
  type TranscriptTurn,
  addTranscriptFragment,
  getSpokenSeconds,
  toConversationTurns,
} from "./live-call-transcript";

const FIRST_CONNECTION: TranscriptTurn[] = [
  { endMs: 800, speaker: "character", startMs: 0, text: "Hi, this is Sarah." },
  { endMs: 5000, speaker: "learner", startMs: 2000, text: "Is the flat free?" },
];

const NOTHING_YET = {
  examCuesSent: 0,
  metLabels: [],
  spokenSeconds: 0,
  turns: [],
  usedHelp: false,
};

function carryFirstConnection() {
  return carryCallSoFar({
    before: NOTHING_YET,
    examCuesSent: 1,
    metLabels: ["Ask about the rent"],
    turns: FIRST_CONNECTION,
    usedHelp: true,
  });
}

describe(carryCallSoFar, () => {
  it("keeps the call so far, with its spoken seconds counted once", () => {
    expect(carryFirstConnection()).toStrictEqual({
      examCuesSent: 1,
      metLabels: ["Ask about the rent"],
      spokenSeconds: 3,
      turns: [
        { endMs: null, speaker: "character", startMs: null, text: "Hi, this is Sarah." },
        { endMs: null, speaker: "learner", startMs: null, text: "Is the flat free?" },
      ],
      usedHelp: true,
    });
  });

  it("starts the next session's words in a turn of their own and adds its spoken seconds to the earlier ones", () => {
    const before = carryFirstConnection();

    // The new session's clock starts again at 0, right after the learner's carried turn.
    const turns = addTranscriptFragment(before.turns, {
      delta: "And the rent?",
      endMs: 2000,
      speaker: "learner",
      startMs: 0,
    });

    expect(toConversationTurns(turns)).toStrictEqual([
      { speaker: "character", text: "Hi, this is Sarah." },
      { speaker: "learner", text: "Is the flat free?" },
      { speaker: "learner", text: "And the rent?" },
    ]);

    expect(getSpokenSeconds(turns)).toBe(2);

    expect(
      carryCallSoFar({
        before,
        examCuesSent: 1,
        metLabels: before.metLabels,
        turns,
        usedHelp: false,
      }),
    ).toMatchObject({ spokenSeconds: 5, usedHelp: false });
  });
});

describe(startCallOver, () => {
  it("drops the call so far but keeps the goals already met", () => {
    expect(startCallOver(carryFirstConnection())).toStrictEqual({
      ...NOTHING_YET,
      metLabels: ["Ask about the rent"],
    });
  });
});
