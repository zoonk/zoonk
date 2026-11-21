import { describe, expect, it } from "vitest";
import { toWordStart } from "./word-start";

describe(toWordStart, () => {
  it("keeps a cut that falls on the space after a word the grader counted", () => {
    expect(toWordStart("alpha beta", 5)).toBe(5);
  });

  it("moves a cut inside a word back to that word's start", () => {
    expect(toWordStart("alpha beta", 8)).toBe(6);
  });

  it("keeps a cut at a word's start or at the end of the text", () => {
    expect(toWordStart("alpha beta", 6)).toBe(6);
    expect(toWordStart("alpha beta", 10)).toBe(10);
  });
});
