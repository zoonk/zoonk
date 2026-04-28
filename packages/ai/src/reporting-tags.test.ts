import { describe, expect, test } from "vitest";
import {
  buildGatewayReportingTags,
  buildGatewayTaskTag,
  extractGatewayDefaultModel,
  extractGatewayTaskName,
} from "./reporting-tags";

describe("reporting tags", () => {
  test("builds the task and default-model tags together", () => {
    expect(
      buildGatewayReportingTags({
        model: "openai/gpt-5.4",
        taskName: "lesson-explanation",
      }),
    ).toEqual(["task:lesson-explanation", "default-model:openai/gpt-5.4"]);
  });

  test("extracts a task name from a task tag", () => {
    expect(extractGatewayTaskName(buildGatewayTaskTag("course-suggestions"))).toBe(
      "course-suggestions",
    );
  });

  test("extracts a default model from a default-model tag", () => {
    expect(extractGatewayDefaultModel("default-model:google/gemini-3-flash")).toBe(
      "google/gemini-3-flash",
    );
  });

  test("ignores unrelated tags", () => {
    expect(extractGatewayTaskName("prompt-version:v2")).toBeNull();
    expect(extractGatewayDefaultModel("task:course-description")).toBeNull();
  });
});
