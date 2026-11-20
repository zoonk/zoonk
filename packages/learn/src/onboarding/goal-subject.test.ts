import { describe, expect, it } from "vitest";
import { getGoalSubject } from "./goal-subject";

describe(getGoalSubject, () => {
  it("starts a mid-sentence subject with a capital", () => {
    expect(getGoalSubject({ details: { subject: "inglês" }, displayName: "Inglês" }, "pt")).toBe(
      "Inglês",
    );
  });

  it("capitalizes in the learner's language", () => {
    expect(
      getGoalSubject({ details: { subject: "ingilizce" }, displayName: "İngilizce" }, "tr"),
    ).toBe("İngilizce");
  });

  it("falls back to the goal's name without a subject", () => {
    expect(getGoalSubject({ details: { subject: " " }, displayName: "ENEM" }, "pt")).toBe("ENEM");
  });
});
