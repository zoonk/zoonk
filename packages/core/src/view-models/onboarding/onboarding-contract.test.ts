import { describe, expect, it } from "vitest";
import { onboardingAnswerInputSchema } from "./onboarding-contract";

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
    expect(onboardingAnswerInputSchema.parse({ question: "reason", reason: null })).toStrictEqual({
      question: "reason",
      reason: null,
    });

    expect(
      onboardingAnswerInputSchema.parse({ question: "target", target: "band 7" }),
    ).toStrictEqual({ question: "target", target: "band 7" });
  });
});
