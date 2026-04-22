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
      "static",
      "visual",
      "static",
      "visual",
      "static",
      "visual",
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
});
