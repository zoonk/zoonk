import { describe, expect, test } from "vitest";
import { buildExplanationActivityPlan } from "./build-explanation-activity-plan";

function buildContent() {
  return {
    anchor: {
      text: "Every heart that turns red in any app is a line someone wrote, running in that moment.",
      title: "In every app",
    },
    explanation: [
      {
        text: "You tap the heart on a photo. A moment later, it is red and the counter jumped from 42 to 43.",
        title: "O toque",
        visual: {
          description: "Two frames side by side: grey heart with 42, then red heart with 43.",
          kind: "image" as const,
        },
      },
      {
        text: "Between the tap and the red heart, the phone did exactly 4 things. They were written somewhere, ready to run.",
        title: "O que está escondido",
        visual: {
          description: "Same two frames with 4 blurred numbered boxes between them.",
          kind: "image" as const,
        },
      },
      {
        text: "Here is the list, in the order the phone ran it: register tap, mark photo as liked, change heart colour to red, add 1 to counter.",
        title: "A lista",
        visual: {
          description: "Numbered list of the 4 actions.",
          kind: "diagram" as const,
        },
      },
      {
        text: "Each of those 4 lines is an instruction: one exact command, one action only.",
        title: "O nome",
        visual: {
          description: "The same list with one line bracketed and labelled '= 1 instruction'.",
          kind: "diagram" as const,
        },
      },
      {
        text: "Look at line 3: 'change heart colour to red'. It does not handle a second tap or a deleted photo. It only changes the colour.",
        title: "A linha 3",
        visual: {
          description: "Close-up of line 3 with a grey-to-red colour swatch.",
          kind: "diagram" as const,
        },
      },
      {
        text: "That is why the heart turned red when you tapped. Not because the phone understood your intent, but because line 3 said so.",
        title: "O retorno",
        visual: {
          description:
            "Beat 1 frames again, with line 3 drawn beside them and an arrow linking it to the red heart.",
          kind: "diagram" as const,
        },
      },
    ],
    predict: [
      {
        options: [
          {
            feedback: "Right. Detection of the tap is always the first link in the chain.",
            isCorrect: true,
            text: "Register that you tapped the icon",
          },
          {
            feedback: "This is the visible result, so it happens later, not first.",
            isCorrect: false,
            text: "Change the heart colour to red",
          },
        ],
        question: "Which of these was the FIRST thing the phone did?",
        step: "O que está escondido",
      },
      {
        options: [
          {
            feedback:
              "Exactly. The phone executes the line as written — it does not guess what you meant.",
            isCorrect: true,
            text: "The heart would turn green when you like",
          },
          {
            feedback: "The phone does not correct an instruction that looks odd. It just runs it.",
            isCorrect: false,
            text: "The phone would keep it red anyway",
          },
        ],
        question: "If line 3 said 'change colour to green' instead, what would happen?",
        step: "A linha 3",
      },
    ],
  };
}

describe(buildExplanationActivityPlan, () => {
  test("builds the ordered learner flow from the narrative explanation content", () => {
    const result = buildExplanationActivityPlan(buildContent());

    expect(result.entries.map((entry) => entry.kind)).toEqual([
      "static",
      "visual",
      "static",
      "visual",
      "multipleChoice",
      "static",
      "visual",
      "static",
      "visual",
      "static",
      "visual",
      "multipleChoice",
      "static",
      "visual",
      "static",
    ]);

    expect(result.sourceSteps).toEqual([
      {
        text: "You tap the heart on a photo. A moment later, it is red and the counter jumped from 42 to 43.",
        title: "O toque",
      },
      {
        text: "Between the tap and the red heart, the phone did exactly 4 things. They were written somewhere, ready to run.",
        title: "O que está escondido",
      },
      {
        text: "Here is the list, in the order the phone ran it: register tap, mark photo as liked, change heart colour to red, add 1 to counter.",
        title: "A lista",
      },
      {
        text: "Each of those 4 lines is an instruction: one exact command, one action only.",
        title: "O nome",
      },
      {
        text: "Look at line 3: 'change heart colour to red'. It does not handle a second tap or a deleted photo. It only changes the colour.",
        title: "A linha 3",
      },
      {
        text: "That is why the heart turned red when you tapped. Not because the phone understood your intent, but because line 3 said so.",
        title: "O retorno",
      },
      {
        text: "Every heart that turns red in any app is a line someone wrote, running in that moment.",
        title: "In every app",
      },
    ]);
  });

  test("falls back to the final step when a predict insertion title does not match", () => {
    const content = buildContent();
    content.predict[0] = {
      ...content.predict[0]!,
      step: "Does not exist",
    };

    const result = buildExplanationActivityPlan(content);

    const finalChecks = result.entries
      .filter((entry) => entry.kind === "multipleChoice")
      .map((entry) => entry.question);

    expect(finalChecks).toEqual([
      "If line 3 said 'change colour to green' instead, what would happen?",
      "Which of these was the FIRST thing the phone did?",
    ]);
  });
});
