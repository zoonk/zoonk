import { describe, expect, it } from "vitest";
import { getPracticeImagePrompts } from "./get-practice-image-prompts";

describe(getPracticeImagePrompts, () => {
  it("returns trimmed authored prompts in visible practice order", () => {
    const prompts = getPracticeImagePrompts({
      steps: [
        {
          context: "The discounted orders are the only ones acting weird.",
          imagePrompt:
            "  A refund dashboard filtered to discounted orders with one outlier row highlighted  ",
          options: [
            { feedback: "Yes", isCorrect: true, text: "Check discounts" },
            { feedback: "No", isCorrect: false, text: "Ignore it" },
          ],
          question: "Where do we start?",
        },
      ],
    });

    expect(prompts).toStrictEqual([
      "A refund dashboard filtered to discounted orders with one outlier row highlighted",
    ]);
  });
});
