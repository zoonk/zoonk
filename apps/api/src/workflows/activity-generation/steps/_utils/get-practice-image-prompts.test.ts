import { describe, expect, test } from "vitest";
import { getPracticeImagePrompts } from "./get-practice-image-prompts";

describe(getPracticeImagePrompts, () => {
  test("returns authored prompts in visible practice order", () => {
    const prompts = getPracticeImagePrompts({
      scenario: {
        imagePrompt: "Opening support desk scene with Maya and a refund dashboard",
        text: "I'm closing the support queue with Maya, and one refund total still looks wrong.",
        title: "Night shift",
      },
      steps: [
        {
          context: "The discounted orders are the only ones acting weird.",
          imagePrompt:
            "A refund dashboard filtered to discounted orders with one outlier row highlighted",
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

  test("fills blank prompts with concrete fallbacks", () => {
    const prompts = getPracticeImagePrompts({
      scenario: {
        imagePrompt: "   ",
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
    });

    expect(prompts[0]).toContain("Short scene label: Late label.");
    expect(prompts[0]).toContain(
      "Situation: I'm checking one last shipping issue with Leo before the warehouse closes.",
    );
    expect(prompts[1]).toContain("Dialogue: These two labels look almost the same");
    expect(prompts[1]).toContain("Question: What should we compare?");
    expect(prompts[1]).toContain("Possible actions: Match labels, Guess city.");
  });
});
