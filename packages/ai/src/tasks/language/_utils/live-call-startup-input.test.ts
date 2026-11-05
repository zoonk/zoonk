import { describe, expect, it } from "vitest";
import { type LiveCallTurn, getLiveCallStartupInput } from "./live-call-startup-input";

const GREETING = "Say you got cut off.";

function turnsOf(count: number, text = "Hi"): LiveCallTurn[] {
  return Array.from({ length: count }, (_turn, index) => ({
    speaker: index % 2 === 0 ? "character" : "learner",
    text: `${text} ${index}`,
  }));
}

function texts(input: ReturnType<typeof getLiveCallStartupInput>) {
  return input.map((item) => item.content[0]?.text);
}

describe(getLiveCallStartupInput, () => {
  it("starts a new call with the greeting alone", () => {
    expect(getLiveCallStartupInput({ greeting: GREETING, turns: [] })).toStrictEqual([
      { content: [{ text: GREETING, type: "input_text" }], role: "developer", type: "message" },
    ]);
  });

  it("gives the learner's words as the user and the character's as the assistant, in order, before the greeting", () => {
    const input = getLiveCallStartupInput({
      greeting: GREETING,
      turns: [
        { speaker: "character", text: "Hi, this is Sarah." },
        { speaker: "learner", text: "Is the flat still free?" },
      ],
    });

    expect(input).toStrictEqual([
      {
        content: [{ text: "Hi, this is Sarah.", type: "output_text" }],
        role: "assistant",
        type: "message",
      },
      {
        content: [{ text: "Is the flat still free?", type: "input_text" }],
        role: "user",
        type: "message",
      },
      { content: [{ text: GREETING, type: "input_text" }], role: "developer", type: "message" },
    ]);
  });

  it("keeps the latest 127 turns, so the greeting is the 128th message", () => {
    const turns = turnsOf(200);
    const input = getLiveCallStartupInput({ greeting: GREETING, turns });

    expect(input).toHaveLength(128);
    expect(texts(input).slice(0, -1)).toStrictEqual(turns.slice(73).map((turn) => turn.text));
    expect(input.at(-1)?.role).toBe("developer");
  });

  it("keeps only the latest turns that fit 8,192 tokens with the greeting, counting each UTF-8 byte", () => {
    // Each turn is 1,010 bytes with its framing, the greeting 28: eight turns fit, nine don't.
    const turns = turnsOf(20, "é".repeat(500));
    const input = getLiveCallStartupInput({ greeting: GREETING, turns });

    expect(texts(input)).toStrictEqual([...turns.slice(12).map((turn) => turn.text), GREETING]);
  });

  it("leaves out a latest turn too long to fit, and everything before it", () => {
    const input = getLiveCallStartupInput({
      greeting: GREETING,
      turns: [
        { speaker: "learner", text: "Short." },
        { speaker: "character", text: "x".repeat(9000) },
      ],
    });

    expect(texts(input)).toStrictEqual([GREETING]);
  });
});
