import { describe, expect, it, vi } from "vitest";
import { insertLessonFeedbackPrompt } from "./append-lesson-feedback-prompt";

vi.mock("./lesson-feedback.prompt.md", () => ({ default: "# Shared feedback" }));

describe(insertLessonFeedbackPrompt, () => {
  it("inserts the shared feedback at the prompt placeholder", () => {
    expect(insertLessonFeedbackPrompt("# Before\n\n{{FEEDBACK}}\n\n# After")).toBe(
      "# Before\n\n# Shared feedback\n\n# After",
    );
  });

  it.each(["# Missing", "{{FEEDBACK}}\n{{FEEDBACK}}"])(
    "rejects a prompt without exactly one feedback placeholder",
    (basePrompt) => {
      expect(() => insertLessonFeedbackPrompt(basePrompt)).toThrow(
        "Lesson feedback prompt must contain exactly one {{FEEDBACK}} placeholder.",
      );
    },
  );
});
