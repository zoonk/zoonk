import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { describe, expect, test } from "vitest";
import { describePlayerStep } from "./player-step";
import {
  getPlayerStepBehavior,
  usesFeedbackScreen,
  usesStaticNavigation,
} from "./player-step-behavior";

function buildStep(overrides: Partial<SerializedStep> = {}): SerializedStep {
  return {
    content: { text: "Hello", title: "Intro", variant: "text" as const },
    fillBlankOptions: [],
    id: "step-1",
    kind: "static",
    matchColumnsRightItems: [],
    position: 0,
    sentence: null,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
    ...overrides,
  };
}

describe(getPlayerStepBehavior, () => {
  test("keeps regular static text in navigable static mode", () => {
    const descriptor = describePlayerStep(buildStep());
    const behavior = getPlayerStepBehavior(descriptor);

    expect(behavior).toMatchObject({
      check: "none",
      feedback: "none",
      layout: "navigable",
      render: "static",
      validation: "none",
    });
    expect(descriptor && usesStaticNavigation(descriptor)).toBe(true);
    expect(descriptor && usesFeedbackScreen(descriptor)).toBe(false);
  });

  test("marks story intro as a primary-action static screen", () => {
    const descriptor = describePlayerStep(
      buildStep({
        content: {
          intro: "Welcome",
          metrics: ["Morale"],
          variant: "storyIntro" as const,
        },
      }),
    );
    const behavior = getPlayerStepBehavior(descriptor);

    expect(behavior).toMatchObject({
      check: "none",
      feedback: "none",
      layout: "default",
      render: "static",
      validation: "none",
    });
    expect(descriptor && usesStaticNavigation(descriptor)).toBe(false);
  });

  test("routes investigation call through shared feedback and validation behavior", () => {
    const step = buildStep({
      content: {
        explanations: [
          {
            accuracy: "best" as const,
            feedback: "Correct",
            id: "exp-1",
            text: "It was DNS",
          },
        ],
        variant: "call" as const,
      },
      kind: "investigation",
    });
    const descriptor = describePlayerStep(step);
    const behavior = getPlayerStepBehavior(descriptor);

    expect(behavior).toMatchObject({
      check: "investigationCall",
      feedback: "screen",
      layout: "default",
      render: "investigation",
      validation: "investigationCall",
    });
    expect(descriptor && usesFeedbackScreen(descriptor)).toBe(true);
  });

  test("skips validation for investigation action while keeping its check behavior", () => {
    const step = buildStep({
      content: {
        actions: [
          {
            finding: "A clue",
            id: "action-1",
            label: "Inspect the logs",
            quality: "critical" as const,
          },
          {
            finding: "Another clue",
            id: "action-2",
            label: "Interview the witness",
            quality: "useful" as const,
          },
        ],
        variant: "action" as const,
      },
      kind: "investigation",
    });
    const descriptor = describePlayerStep(step);
    const behavior = getPlayerStepBehavior(descriptor);

    expect(behavior).toMatchObject({
      check: "investigationAction",
      feedback: "inline",
      render: "investigation",
      validation: "none",
    });
  });
});
