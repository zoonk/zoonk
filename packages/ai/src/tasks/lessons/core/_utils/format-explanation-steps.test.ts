import { describe, expect, test } from "vitest";
import { formatExplanationStepsForPrompt } from "./format-explanation-steps";

describe(formatExplanationStepsForPrompt, () => {
  test("formats numbered steps with title and text", () => {
    expect(
      formatExplanationStepsForPrompt([
        {
          text: "Data moves in smaller chunks.",
          title: "Packets",
        },
      ]),
    ).toBe("1. Packets: Data moves in smaller chunks.");
  });

  test("formats numbered steps with title only", () => {
    expect(
      formatExplanationStepsForPrompt([
        {
          text: "",
          title: "Why does this happen?",
        },
      ]),
    ).toBe("1. Why does this happen?");
  });

  test("formats numbered steps with text only", () => {
    expect(
      formatExplanationStepsForPrompt([
        {
          text: "The labels show each network job.",
          title: "",
        },
      ]),
    ).toBe("1. The labels show each network job.");
  });

  test("formats multiple steps as one prompt block", () => {
    expect(
      formatExplanationStepsForPrompt([
        {
          text: "",
          title: "Why does this happen?",
        },
        {
          text: "The labels show each network job.",
          title: "Layer labels",
        },
      ]),
    ).toBe("1. Why does this happen?\n2. Layer labels: The labels show each network job.");
  });
});
