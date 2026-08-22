import { describe, expect, it } from "vitest";
import { getGenerationLimit } from "./generation-limit";

describe(getGenerationLimit, () => {
  it("parses the API generation limit contract", () => {
    expect(
      getGenerationLimit({
        error: {
          code: "GENERATION_LIMIT_REACHED",
          details: { period: "month", resource: "lessonQuestion", viewer: "subscriber" },
          message: "Generation limit reached",
        },
      }),
    ).toStrictEqual({ period: "month", resource: "lessonQuestion", viewer: "subscriber" });
  });

  it("rejects unrelated and malformed API errors", () => {
    expect(getGenerationLimit({ error: { code: "INTERNAL_ERROR" } })).toBeNull();

    expect(
      getGenerationLimit({
        error: {
          code: "GENERATION_LIMIT_REACHED",
          details: { period: "year", resource: "lesson", viewer: "subscriber" },
        },
      }),
    ).toBeNull();
  });
});
