import { describe, expect, test } from "vitest";
import { buildExplanationActivityPlan } from "./build-explanation-activity-plan";

function buildContent() {
  return {
    anchor: {
      text: "This is why Google Maps can keep updating your route instead of redrawing the whole city from scratch.",
      title: "This is why",
    },
    concepts: [
      {
        text: "Packets travel as smaller pieces so each network step can handle them predictably.",
        title: "Small chunks",
        visual: null,
      },
      {
        text: "Each layer adds its own label for a different job, like delivery details versus app details.",
        title: "Layer labels",
        visual: {
          description:
            "A diagram showing one packet with stacked labels for app, transport, and network layers.",
          kind: "diagram" as const,
        },
      },
      {
        text: "Routers look at the network label, not the whole message meaning.",
        title: "Router focus",
        visual: null,
      },
    ],
    initialQuestion: {
      explanation:
        "The packet keeps getting small pieces of information added so each layer knows what to do next.",
      question: "Why doesn't internet data travel as one giant unlabeled blob?",
      visual: {
        description: "An image of a message turning into a packet with labels added around it.",
        kind: "image" as const,
      },
    },
    predict: [
      {
        concept: "Layer labels",
        options: [
          {
            feedback:
              "Yes. Different labels help different parts of the network do different jobs.",
            isCorrect: true,
            text: "Because each layer needs its own information",
          },
          {
            feedback: "Not quite. The point is not decoration but different jobs.",
            isCorrect: false,
            text: "Because packets look nicer with extra labels",
          },
        ],
        question: "Why add more than one label to the same packet?",
      },
      {
        concept: "Router focus",
        options: [
          {
            feedback: "Right. Routers care about where to send it next.",
            isCorrect: true,
            text: "The network label",
          },
          {
            feedback: "Not this one. Routers are not reading the full app meaning.",
            isCorrect: false,
            text: "The app's full message",
          },
        ],
        question: "Which part does a router mainly use?",
      },
    ],
    scenario: {
      text: "You send a WhatsApp photo on the bus and it still reaches your friend even though it passes through many different network points on the way.",
      title: "On the bus",
    },
  };
}

describe(buildExplanationActivityPlan, () => {
  test("builds the ordered learner flow from the structured explanation content", () => {
    const result = buildExplanationActivityPlan(buildContent());

    expect(result.entries.map((entry) => entry.kind)).toEqual([
      "static",
      "visual",
      "static",
      "static",
      "static",
      "static",
      "visual",
      "multipleChoice",
      "static",
      "multipleChoice",
      "static",
    ]);

    expect(result.sourceSteps).toEqual([
      {
        text: "Why doesn't internet data travel as one giant unlabeled blob?",
        title: "",
      },
      {
        text: "The packet keeps getting small pieces of information added so each layer knows what to do next.",
        title: "",
      },
      {
        text: "You send a WhatsApp photo on the bus and it still reaches your friend even though it passes through many different network points on the way.",
        title: "On the bus",
      },
      {
        text: "Packets travel as smaller pieces so each network step can handle them predictably.",
        title: "Small chunks",
      },
      {
        text: "Each layer adds its own label for a different job, like delivery details versus app details.",
        title: "Layer labels",
      },
      {
        text: "Routers look at the network label, not the whole message meaning.",
        title: "Router focus",
      },
      {
        text: "This is why Google Maps can keep updating your route instead of redrawing the whole city from scratch.",
        title: "This is why",
      },
    ]);
  });

  test("falls back to the final concept when a predict insertion title does not match", () => {
    const content = buildContent();
    content.predict[0] = {
      ...content.predict[0]!,
      concept: "Does not exist",
    };

    const result = buildExplanationActivityPlan(content);

    const finalChecks = result.entries
      .filter((entry) => entry.kind === "multipleChoice")
      .map((entry) => entry.question);

    expect(finalChecks).toEqual([
      "Why add more than one label to the same packet?",
      "Which part does a router mainly use?",
    ]);
  });
});
