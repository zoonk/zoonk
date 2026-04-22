import { describe, expect, test } from "vitest";
import { buildStaticStepRecords } from "./build-static-step-records";

describe(buildStaticStepRecords, () => {
  test("returns empty array when steps are empty", () => {
    const result = buildStaticStepRecords({
      activityId: "1",
      images: [],
      steps: [],
    });

    expect(result).toEqual([]);
  });

  test("builds static rows with embedded images and sequential positions", () => {
    const result = buildStaticStepRecords({
      activityId: "42",
      images: [
        { prompt: "A lesson illustration for Step 1", url: "https://example.com/step-1.webp" },
        { prompt: "A lesson illustration for Step 2", url: "https://example.com/step-2.webp" },
      ],
      steps: [
        { text: "Step 1 text", title: "Step 1" },
        { text: "Step 2 text", title: "Step 2" },
      ],
    });

    expect(result).toEqual([
      {
        activityId: "42",
        content: {
          image: {
            prompt: "A lesson illustration for Step 1",
            url: "https://example.com/step-1.webp",
          },
          text: "Step 1 text",
          title: "Step 1",
          variant: "text",
        },
        isPublished: true,
        kind: "static",
        position: 0,
      },
      {
        activityId: "42",
        content: {
          image: {
            prompt: "A lesson illustration for Step 2",
            url: "https://example.com/step-2.webp",
          },
          text: "Step 2 text",
          title: "Step 2",
          variant: "text",
        },
        isPublished: true,
        kind: "static",
        position: 1,
      },
    ]);
  });

  test("throws when step and image counts do not match", () => {
    expect(() =>
      buildStaticStepRecords({
        activityId: "1",
        images: [{ prompt: "Only one image" }],
        steps: [
          { text: "Step 1 text", title: "Step 1" },
          { text: "Step 2 text", title: "Step 2" },
        ],
      }),
    ).toThrow("Generated image count does not match step count");
  });
});
