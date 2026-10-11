import {
  MAX_CONVERSATION_TURNS,
  MAX_CONVERSATION_TURN_LENGTH,
} from "@zoonk/core/language/conversations/contract";
import { describe, expect, it } from "vitest";
import {
  type TranscriptTurn,
  addTranscriptFragment,
  addTypedReply,
  getSpokenSeconds,
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

describe(getSpokenSeconds, () => {
  it("adds up the learner's spoken turns, not typed ones or the character's", () => {
    const turns = addTranscriptFragment(addTypedReply(buildCall(), "Saturday?"), {
      delta: "Thanks, bye!",
      endMs: 14_600,
      speaker: "learner",
      startMs: 13_000,
    });

    expect(getSpokenSeconds(turns)).toBe(4);
  });
});

describe(toConversationTurns, () => {
  it("drops empty turns and keeps saved turns within the limits", () => {
    const turns = [
      ...addTypedReply([], "   "),
      ...Array.from({ length: MAX_CONVERSATION_TURNS + 10 }, () =>
        addTypedReply([], "x".repeat(MAX_CONVERSATION_TURN_LENGTH + 100)),
      ).flat(),
    ];

    const saved = toConversationTurns(turns);

    expect(saved).toHaveLength(MAX_CONVERSATION_TURNS);
    expect(saved[0]?.text).toHaveLength(MAX_CONVERSATION_TURN_LENGTH);
  });
});
