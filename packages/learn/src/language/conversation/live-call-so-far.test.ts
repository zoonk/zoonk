import { describe, expect, it } from "vitest";
import {
  type CallSoFar,
  carryCallSoFar,
  startCallOver,
  toCallCompletion,
} from "./live-call-so-far";
import { type TranscriptTurn, addTranscriptFragment } from "./live-call-transcript";

const FIRST_CONNECTION: TranscriptTurn[] = [
  { endMs: 800, speaker: "character", startMs: 0, text: "Hi, this is Sarah." },
  { endMs: 2400, speaker: "learner", startMs: 2000, text: "Is the flat free?" },
];

const NOTHING_YET: CallSoFar = {
  connectionId: null,
  examCuesSent: 0,
  metLabels: [],
  spokenMs: 0,
  turns: [],
  usedHelp: false,
};

function carryFirstConnection() {
  return carryCallSoFar({
    before: NOTHING_YET,
    connectionId: "first",
    examCuesSent: 1,
    live: true,
    metLabels: ["Ask about the rent"],
    turns: FIRST_CONNECTION,
    usedHelp: true,
  });
}

function carryReconnect({ connectionId, live }: { connectionId: string | null; live: boolean }) {
  const before = carryFirstConnection();

  return carryCallSoFar({
    before,
    connectionId,
    examCuesSent: before.examCuesSent,
    live,
    metLabels: before.metLabels,
    turns: before.turns,
    usedHelp: before.usedHelp,
  });
}

describe(carryCallSoFar, () => {
  it("keeps a call that went live, with the connection completion names", () => {
    expect(carryFirstConnection()).toStrictEqual({
      connectionId: "first",
      examCuesSent: 1,
      metLabels: ["Ask about the rent"],
      spokenMs: 400,
      turns: [
        { endMs: null, speaker: "character", startMs: null, text: "Hi, this is Sarah." },
        { endMs: null, speaker: "learner", startMs: null, text: "Is the flat free?" },
      ],
      usedHelp: true,
    });
  });

  it("has no call to save when no connection went live, even one it reserved", () => {
    expect(
      carryCallSoFar({
        ...NOTHING_YET,
        before: NOTHING_YET,
        connectionId: "never-live",
        live: false,
      }),
    ).toMatchObject({ connectionId: null });
  });

  it("names a reconnect's own reservation once it has one, live or not, since completion takes the latest", () => {
    expect(carryReconnect({ connectionId: "reconnect", live: false })).toMatchObject({
      connectionId: "reconnect",
    });

    expect(carryReconnect({ connectionId: null, live: false })).toMatchObject({
      connectionId: "first",
    });
  });

  it("starts the next session's words in a turn of their own", () => {
    const turns = addTranscriptFragment(carryFirstConnection().turns, {
      delta: "And the rent?",
      endMs: 400,
      speaker: "learner",
      startMs: 0,
    });

    expect(turns.map((turn) => turn.text)).toStrictEqual([
      "Hi, this is Sarah.",
      "Is the flat free?",
      "And the rent?",
    ]);
  });
});

describe(toCallCompletion, () => {
  it("rounds the whole call's speech once: two 400 ms replies a drop apart make a second", () => {
    const before = carryFirstConnection();

    const turns = addTranscriptFragment(before.turns, {
      delta: "And the rent?",
      endMs: 400,
      speaker: "learner",
      startMs: 0,
    });

    const callSoFar = carryCallSoFar({
      ...before,
      before,
      connectionId: "second",
      live: true,
      turns,
    });

    expect(toCallCompletion(callSoFar)).toStrictEqual({
      connectionId: "second",
      spokenSeconds: 1,
      turns: [
        { speaker: "character", text: "Hi, this is Sarah." },
        { speaker: "learner", text: "Is the flat free?" },
        { speaker: "learner", text: "And the rent?" },
      ],
      usedHelp: true,
    });
  });

  it("has nothing to complete without a connection", () => {
    expect(toCallCompletion(NOTHING_YET)).toBeNull();
  });
});

describe(startCallOver, () => {
  it("drops the call so far and its connection but keeps the goals already met", () => {
    expect(startCallOver(carryFirstConnection())).toStrictEqual({
      ...NOTHING_YET,
      metLabels: ["Ask about the rent"],
    });
  });
});
