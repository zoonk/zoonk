import { describe, expect, test } from "vitest";
import { getPracticeImagePrompts } from "./get-practice-image-prompts";

describe(getPracticeImagePrompts, () => {
  test("returns trimmed authored prompts in visible practice order", () => {
    const prompts = getPracticeImagePrompts({
      scenario: {
        imagePrompt: "  Opening support desk scene with Maya and a refund dashboard  ",
        text: "I'm closing the support queue with Maya, and one refund total still looks wrong.",
        title: "Night shift",
      },
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

    expect(prompts).toEqual([
      "Opening support desk scene with Maya and a refund dashboard",
      "A refund dashboard filtered to discounted orders with one outlier row highlighted",
    ]);
  });

  test("throws when the scenario image prompt is blank", () => {
    expect(() =>
      getPracticeImagePrompts({
        scenario: {
          imagePrompt: "   ",
          text: "I'm checking one last shipping issue with Leo before the warehouse closes.",
          title: "Late label",
        },
        steps: [],
      }),
    ).toThrow("Missing practice image prompt for scenario");
  });

  test("throws when a step image prompt is blank", () => {
    expect(() =>
      getPracticeImagePrompts({
        scenario: {
          imagePrompt: "Opening shipping desk scene",
          text: "I'm checking one last shipping issue with Leo before the warehouse closes.",
          title: "Late label",
        },
        steps: [
          {
            context: "These two labels look almost the same, but the destination scan disagrees.",
            imagePrompt: "",
            options: [
              { feedback: "Yes", isCorrect: true, text: "Match labels" },
              { feedback: "No", isCorrect: false, text: "Guess city" },
            ],
            question: "What should we compare?",
          },
        ],
      }),
    ).toThrow("Missing practice image prompt for step 1");
  });
});
