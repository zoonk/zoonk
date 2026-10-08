import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { validateActivity } from "../validate-activity";
import { findErrorTemplate } from "./reasoning-writing";

describe(findErrorTemplate.id, () => {
  const spotTheAi = {
    ...activityContentFixtures.findError,
    fields: { ...activityContentFixtures.findError.fields, author: "ai" },
    prompt: "Spot the AI's mistake.",
  };

  it("takes an AI assistant's answer to check (Spot the AI's mistake)", () => {
    const result = validateActivity(spotTheAi);

    expect(result.ok ? [] : result.issues).toStrictEqual([]);

    expect(
      result.ok && result.content.template === "findError" && result.content.fields.author,
    ).toBe("ai");
  });

  it("still finds the wrong step by code when the AI wrote the answer", () => {
    const wrongStep = { ...spotTheAi, fields: { ...spotTheAi.fields, errorStepId: "s1" } };
    const result = validateActivity(wrongStep);

    expect(result.ok ? [] : result.issues.map((item) => item.code)).toContain("answerMismatch");
  });

  it("puts the mistake before the conclusion, so learners check every step", () => {
    const steps = [
      { id: "s1", text: "Most of the survey's users are students." },
      { id: "s2", text: "Students said they want shorter lessons." },
      { id: "s3", text: "So every user wants shorter lessons." },
    ];

    const lastStep = validateActivity({
      ...spotTheAi,
      fields: { ...spotTheAi.fields, errorStepId: "s3", steps },
    });

    const middleStep = validateActivity({
      ...spotTheAi,
      fields: { ...spotTheAi.fields, errorStepId: "s2", steps },
    });

    expect(lastStep.ok ? [] : lastStep.issues.map((item) => item.path)).toContain(
      "fields.errorStepId",
    );

    expect(middleStep.ok ? [] : middleStep.issues).toStrictEqual([]);
  });

  it("accepts only an AI assistant as the other author", () => {
    const result = validateActivity({
      ...spotTheAi,
      fields: { ...spotTheAi.fields, author: "teacher" },
    });

    expect(result.ok ? [] : result.issues.map((item) => item.code)).toContain("invalidSchema");
  });
});
