import {
  MAX_CONVERSATION_TURNS,
  MAX_CONVERSATION_TURN_LENGTH,
} from "@zoonk/core/language/conversations/turn-limits";
import { describe, expect, it } from "vitest";
import {
  type TranscriptTurn,
  addTranscriptFragment,
  addTypedReply,
  getSpokenMs,
  toConversationTurns,
} from "./live-call-transcript";

function buildCall(): TranscriptTurn[] {
  return [
    { delta: "Hi! Are you", endMs: 900, speaker: "character" as const, startMs: 0 },
    { delta: " calling about the flat?", endMs: 2000, speaker: "character" as const, startMs: 900 },
    { delta: "Yes, is it", endMs: 4000, speaker: "learner" as const, startMs: 3000 },
    { delta: " still available?", endMs: 5500, speaker: "learner" as const, startMs: 4000 },
    { delta: "It is.", endMs: 7000, speaker: "character" as const, startMs: 6000 },
  ].reduce<TranscriptTurn[]>((turns, fragment) => addTranscriptFragment(turns, fragment), []);
}

describe(addTranscriptFragment, () => {
  it("joins a speaker's fragments into one turn until the other speaker talks", () => {
    expect(toConversationTurns(buildCall())).toStrictEqual([
      { speaker: "character", text: "Hi! Are you calling about the flat?" },
      { speaker: "learner", text: "Yes, is it still available?" },
      { speaker: "character", text: "It is." },
    ]);
  });

  it("keeps a space between a speaker's words said after a pause", () => {
    const turns = [
      { delta: "It's still available.", endMs: 2000, speaker: "character" as const, startMs: 0 },
      { delta: "Are you", endMs: 31_200, speaker: "character" as const, startMs: 31_000 },
      { delta: " still there?", endMs: 31_600, speaker: "character" as const, startMs: 31_200 },
      { delta: "$2,", endMs: 33_000, speaker: "character" as const, startMs: 32_800 },
      { delta: "400", endMs: 33_200, speaker: "character" as const, startMs: 33_000 },
    ].reduce<TranscriptTurn[]>((all, fragment) => addTranscriptFragment(all, fragment), []);

    expect(toConversationTurns(turns)).toStrictEqual([
      { speaker: "character", text: "It's still available. Are you still there? $2,400" },
    ]);
  });

  it("starts a new spoken turn after a typed reply", () => {
    const typed = addTypedReply(buildCall(), "Can I see it on Saturday?");

    const turns = addTranscriptFragment(typed, {
      delta: "And the deposit?",
      endMs: 12_000,
      speaker: "learner",
      startMs: 10_000,
    });

    expect(toConversationTurns(turns).slice(-2)).toStrictEqual([
      { speaker: "learner", text: "Can I see it on Saturday?" },
      { speaker: "learner", text: "And the deposit?" },
    ]);
  });
});

describe(getSpokenMs, () => {
  it("adds up the learner's spoken turns, not typed ones or the character's", () => {
    const turns = addTranscriptFragment(addTypedReply(buildCall(), "Saturday?"), {
      delta: "Thanks, bye!",
      endMs: 14_600,
      speaker: "learner",
      startMs: 13_000,
    });

    expect(getSpokenMs(turns)).toBe(4100);
  });
});

describe(toConversationTurns, () => {
  it("drops empty turns and keeps the newest turns within the limits", () => {
    const turns = [
      ...Array.from({ length: MAX_CONVERSATION_TURNS + 10 }, (_, index) =>
        addTypedReply([], `${index} ${"x".repeat(MAX_CONVERSATION_TURN_LENGTH)}`),
      ).flat(),
      ...addTypedReply([], "   "),
    ];

    const saved = toConversationTurns(turns);
    const indexes = saved.map((turn) => turn.text.split(" ", 1)[0]);

    expect(saved).toHaveLength(MAX_CONVERSATION_TURNS);
    expect(saved[0]?.text).toHaveLength(MAX_CONVERSATION_TURN_LENGTH);
    expect([indexes.at(0), indexes.at(-1)]).toStrictEqual(["10", `${MAX_CONVERSATION_TURNS + 9}`]);
  });
});
