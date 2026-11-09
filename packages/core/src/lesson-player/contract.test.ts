import { describe, expect, it } from "vitest";
import { MAX_STEP_ID_LENGTH, idSchema } from "../library/steps/contract/content-schemas";
import { lessonStepAnswerSchema } from "./contract";

describe("step ids in an answer", () => {
  it("takes every id the step contract accepts, and the contract takes no longer one", () => {
    const longest = "a".repeat(MAX_STEP_ID_LENGTH);

    expect(idSchema.safeParse(`${longest}a`).success).toBe(false);
    expect(idSchema.safeParse(longest).success).toBe(true);

    expect(
      lessonStepAnswerSchema.safeParse({ choiceIds: [longest], kind: "challenge" }).success,
    ).toBe(true);

    expect(lessonStepAnswerSchema.safeParse({ kind: "check", optionId: longest }).success).toBe(
      true,
    );
  });
});
