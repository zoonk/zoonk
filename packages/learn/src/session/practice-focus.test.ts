import { describe, expect, it } from "vitest";
import { getPracticeFocus } from "./practice-focus";

const PRACTICE = {
  areas: ["Quantum physics from scratch"],
  fullReview: false,
  kind: "practice" as const,
  mistakesOnly: false,
  topics: ["Reading slope as a rate", "Using powers of ten"],
};

describe(getPracticeFocus, () => {
  it("names a practice after the topic most of its questions are on", () => {
    expect(getPracticeFocus(PRACTICE)).toStrictEqual({ kind: "topic", name: "Reading slope as a rate" });
  });

  it("tells apart two practices on one subject by their topics", () => {
    const later = { ...PRACTICE, topics: ["Using powers of ten"] };

    expect(getPracticeFocus(later)).not.toStrictEqual(getPracticeFocus(PRACTICE));
  });

  it("names a practice without topics after its subjects", () => {
    expect(getPracticeFocus({ ...PRACTICE, topics: [] })).toStrictEqual({
      kind: "areas",
      names: ["Quantum physics from scratch"],
    });
  });

  it("names neither for mistakes or a review of every topic", () => {
    expect(getPracticeFocus({ ...PRACTICE, mistakesOnly: true })).toBeNull();
    expect(getPracticeFocus({ ...PRACTICE, fullReview: true })).toBeNull();
    expect(getPracticeFocus({ ...PRACTICE, areas: [], topics: [] })).toBeNull();
  });
});
