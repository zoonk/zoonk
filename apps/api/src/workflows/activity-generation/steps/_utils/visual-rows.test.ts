import { describe, expect, test } from "vitest";
import { buildVisualStepRows } from "./visual-rows";

describe(buildVisualStepRows, () => {
  test("returns empty array when visuals are empty", () => {
    const result = buildVisualStepRows({ activityId: "1", visuals: [] });

    expect(result).toEqual([]);
  });

  test("builds rows with correct positions from visuals array", () => {
    const visuals = [
      { code: "const x = 1;", kind: "code", language: "typescript" },
      { kind: "image", prompt: "A visual", url: "https://example.com/image.webp" },
    ];

    const result = buildVisualStepRows({ activityId: "42", visuals });

    expect(result).toHaveLength(2);

    expect(result[0]).toMatchObject({
      activityId: "42",
      content: { code: "const x = 1;", kind: "code", language: "typescript" },
      isPublished: true,
      kind: "visual",
      position: 1,
    });

    expect(result[1]).toMatchObject({
      activityId: "42",
      content: { kind: "image", prompt: "A visual", url: "https://example.com/image.webp" },
      isPublished: true,
      kind: "visual",
      position: 3,
    });
  });

  test("places visual steps at odd positions (content + 1)", () => {
    const visuals = [{ kind: "chart" }, { kind: "table" }, { kind: "diagram" }];

    const result = buildVisualStepRows({ activityId: "1", visuals });

    expect(result.map((row) => row.position)).toEqual([1, 3, 5]);
  });
});
