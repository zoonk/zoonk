import { describe, expect, it } from "vitest";
import { activityAnswerSchema } from "./activity-answer-schema";
import { MAX_PROGRAM_OUTPUT_LENGTH, MAX_QUERY_ROWS } from "./programs/program-limits";

describe("an activity answer sent to save", () => {
  it("accepts all the output a program run keeps", () => {
    const answer = { kind: "output", output: "x".repeat(MAX_PROGRAM_OUTPUT_LENGTH) };

    expect(activityAnswerSchema.safeParse(answer).success).toBe(true);
  });

  it("accepts every row a query run shows, each cell as long as a run keeps", () => {
    const rows = Array.from({ length: MAX_QUERY_ROWS }, () => [
      "x".repeat(MAX_PROGRAM_OUTPUT_LENGTH),
    ]);

    expect(activityAnswerSchema.safeParse({ columns: ["name"], kind: "rows", rows }).success).toBe(
      true,
    );
  });
});
