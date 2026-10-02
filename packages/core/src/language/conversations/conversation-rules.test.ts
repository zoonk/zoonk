import { describe, expect, it } from "vitest";
import {
  getCheckpointMinutes,
  getConversationBrainPower,
  getConversationStars,
  getMetObjectives,
  hasPassedConversation,
} from "./conversation-rules";

describe(getCheckpointMinutes, () => {
  it("grows with the level", () => {
    expect(getCheckpointMinutes("A1")).toBe(1);
    expect(getCheckpointMinutes("A2")).toBe(1);
    expect(getCheckpointMinutes("B1")).toBe(2);
    expect(getCheckpointMinutes("C1")).toBe(3);
    expect(getCheckpointMinutes("C2")).toBe(4);
  });
});

describe(hasPassedConversation, () => {
  it("uses the checkpoint pass mark: most of what the call asked for", () => {
    expect(hasPassedConversation({ objectives: 4, objectivesMet: 3 })).toBe(true);
    expect(hasPassedConversation({ objectives: 4, objectivesMet: 2 })).toBe(false);
    expect(hasPassedConversation({ objectives: 3, objectivesMet: 3 })).toBe(true);
    expect(hasPassedConversation({ objectives: 3, objectivesMet: 2 })).toBe(false);
  });

  it("never passes a call without objectives", () => {
    expect(hasPassedConversation({ objectives: 0, objectivesMet: 0 })).toBe(false);
  });
});

describe(getConversationStars, () => {
  it("gives a star for finishing, one for every objective and one without help", () => {
    expect(getConversationStars({ objectives: 3, objectivesMet: 3, usedHelp: false })).toBe(3);
    expect(getConversationStars({ objectives: 3, objectivesMet: 3, usedHelp: true })).toBe(2);
    expect(getConversationStars({ objectives: 3, objectivesMet: 1, usedHelp: true })).toBe(1);
  });
});

describe(getMetObjectives, () => {
  it("keeps the scenario's labels once each, in the scenario's order", () => {
    const objectives = [{ label: "Is it available?" }, { label: "Book a viewing" }];

    expect(
      getMetObjectives({
        labels: ["Book a viewing", "Pay now", "Book a viewing", "Is it available?"],
        objectives,
      }),
    ).toStrictEqual(["Is it available?", "Book a viewing"]);
  });
});

describe(getConversationBrainPower, () => {
  it("pays each objective met", () => {
    expect(getConversationBrainPower({ checkpoint: null, objectivesMet: 2 })).toBe(20);
  });

  it("adds the boss bonus only when the checkpoint call is won", () => {
    expect(
      getConversationBrainPower({ checkpoint: { kind: "boss", passed: true }, objectivesMet: 3 }),
    ).toBe(230);

    expect(
      getConversationBrainPower({ checkpoint: { kind: "boss", passed: false }, objectivesMet: 1 }),
    ).toBe(10);
  });
});
