import { describe, expect, it } from "vitest";
import { matchTypedAnswer, normalizeTypedAnswer } from "./typed-answer-match";

describe(normalizeTypedAnswer, () => {
  it("ignores case, spacing, quotes and sentence punctuation", () => {
    expect(normalizeTypedAnswer("  The   Mitochondria! ")).toBe("the mitochondria");
    expect(normalizeTypedAnswer("“Paris.”")).toBe("paris");
    expect(normalizeTypedAnswer("don’t")).toBe(normalizeTypedAnswer("don't"));
  });

  it("keeps accents because they change words", () => {
    expect(normalizeTypedAnswer("É")).not.toBe(normalizeTypedAnswer("e"));
  });

  it("writes decimal commas as points and keeps numbers intact", () => {
    expect(normalizeTypedAnswer("1,5")).toBe("1.5");
    expect(normalizeTypedAnswer("3.14.")).toBe("3.14");
    expect(normalizeTypedAnswer("-2")).toBe("-2");
  });

  it("keeps hyphens and apostrophes inside words", () => {
    expect(normalizeTypedAnswer("well-known")).toBe("well-known");
    expect(normalizeTypedAnswer("l'heure")).toBe("l'heure");
    expect(normalizeTypedAnswer("a - b")).toBe("a b");
  });
});

describe(matchTypedAnswer, () => {
  it("matches the same answer written differently without a model", () => {
    expect(
      matchTypedAnswer({ acceptedAnswers: ["Photosynthesis"], answer: "photosynthesis." }),
    ).toStrictEqual({ acceptedAnswer: "Photosynthesis", kind: "exact" });
  });

  it("compares numbers by value", () => {
    expect(matchTypedAnswer({ acceptedAnswers: ["0.5"], answer: "0,50" }).kind).toBe("exact");
    expect(matchTypedAnswer({ acceptedAnswers: ["0.5"], answer: ".5" }).kind).toBe("exact");
    expect(matchTypedAnswer({ acceptedAnswers: ["12"], answer: "13" }).kind).toBe("none");
  });

  it("never treats a different number as a typo", () => {
    expect(matchTypedAnswer({ acceptedAnswers: ["1985"], answer: "1986" }).kind).toBe("none");

    expect(matchTypedAnswer({ acceptedAnswers: ["year 1985"], answer: "year 1986" }).kind).toBe(
      "none",
    );
  });

  it("flags missing accents and small slips as typos", () => {
    expect(matchTypedAnswer({ acceptedAnswers: ["São Paulo"], answer: "Sao Paulo" }).kind).toBe(
      "typo",
    );

    expect(
      matchTypedAnswer({ acceptedAnswers: ["photosynthesis"], answer: "photosyntesis" }),
    ).toStrictEqual({ acceptedAnswer: "photosynthesis", kind: "typo" });

    expect(matchTypedAnswer({ acceptedAnswers: ["receive"], answer: "recieve" }).kind).toBe("typo");
  });

  it("allows no slip in short words, where one letter makes another word", () => {
    expect(matchTypedAnswer({ acceptedAnswers: ["cat"], answer: "car" }).kind).toBe("none");
  });

  it("does not stretch the typo allowance to different words", () => {
    expect(
      matchTypedAnswer({ acceptedAnswers: ["mitochondria"], answer: "chloroplast" }).kind,
    ).toBe("none");

    expect(matchTypedAnswer({ acceptedAnswers: ["automobile"], answer: "car" }).kind).toBe("none");
  });

  it("prefers an exact match over a typo match", () => {
    expect(
      matchTypedAnswer({ acceptedAnswers: ["colour", "color"], answer: "color" }),
    ).toStrictEqual({ acceptedAnswer: "color", kind: "exact" });
  });

  it("returns no match for blank answers or when nothing is accepted", () => {
    expect(matchTypedAnswer({ acceptedAnswers: ["yes"], answer: " ?! " }).kind).toBe("none");
    expect(matchTypedAnswer({ acceptedAnswers: [], answer: "anything" }).kind).toBe("none");
  });
});
