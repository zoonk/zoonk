import { describe, expect, it } from "vitest";
import { goalUnderstandingInputSchema, onboardingAnswerInputSchema } from "./onboarding-contract";

describe("a goal sent to be read", () => {
  const notes = "0195f3a4-7c1e-7b2a-9c3d-4e5f60718293";

  it("takes words alone, as clients before material sent them", () => {
    expect(
      goalUnderstandingInputSchema.safeParse({ goal: "physics", language: "en" }).success,
    ).toBe(true);
  });

  it("takes material with or without what the learner wants from it", () => {
    const sent = [
      { goal: "test on Friday", language: "en", materialIntent: "exam", sourceIds: [notes] },
      { goal: "test on Friday", language: "en", sourceIds: [notes] },
    ];

    expect(
      sent.map((input) => goalUnderstandingInputSchema.safeParse(input).success),
    ).toStrictEqual([true, true]);
  });

  it("refuses an intent without material", () => {
    const sent = [
      { goal: "test on Friday", language: "en", materialIntent: "exam" },
      { goal: "test on Friday", language: "en", materialIntent: "exam", sourceIds: [] },
    ];

    expect(
      sent.map((input) => goalUnderstandingInputSchema.safeParse(input).success),
    ).toStrictEqual([false, false]);
  });
});

describe("an onboarding answer", () => {
  it("reads a skipped answer left out as null", () => {
    expect(onboardingAnswerInputSchema.parse({ question: "targetDate" })).toStrictEqual({
      question: "targetDate",
      targetDate: null,
    });

    expect(onboardingAnswerInputSchema.parse({ question: "role" })).toStrictEqual({
      question: "role",
      role: null,
    });

    expect(onboardingAnswerInputSchema.parse({ question: "level" })).toStrictEqual({
      level: null,
      question: "level",
    });
  });

  it("keeps an explicit null and a given answer", () => {
    expect(onboardingAnswerInputSchema.parse({ question: "role", role: null })).toStrictEqual({
      question: "role",
      role: null,
    });

    expect(
      onboardingAnswerInputSchema.parse({ question: "target", target: "band 7" }),
    ).toStrictEqual({ question: "target", target: "band 7" });
  });
});
