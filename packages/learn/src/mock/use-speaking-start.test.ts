import { describe, expect, it } from "vitest";
import { canStartSpeaking } from "./use-speaking-start";

describe(canStartSpeaking, () => {
  it("waits while the speaking paper is being written", () => {
    expect(canStartSpeaking({ error: false, pending: false, writing: true })).toBe(false);
  });

  it("offers Start again when opening the written paper failed", () => {
    expect(canStartSpeaking({ error: true, pending: false, writing: true })).toBe(true);
  });

  it("starts from the section's first screen", () => {
    expect(canStartSpeaking({ error: false, pending: false, writing: false })).toBe(true);
  });

  it("waits while a step is still going", () => {
    expect(canStartSpeaking({ error: true, pending: true, writing: true })).toBe(false);
  });
});
