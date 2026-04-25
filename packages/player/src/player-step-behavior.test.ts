import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { describe, expect, test } from "vitest";
import { describePlayerStep } from "./player-step";
import {
  getPlayerStepBehavior,
  hasFeedbackScreen,
  hasStaticNavigation,
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
    expect(hasStaticNavigation(descriptor)).toBe(true);
    expect(hasFeedbackScreen(descriptor)).toBe(false);
  });

  test("marks story intro as a hero static screen", () => {
    const descriptor = describePlayerStep(
      buildStep({
        content: {
          text: "Welcome",
          title: "Story intro",
          variant: "intro" as const,
        },
      }),
    );
    const behavior = getPlayerStepBehavior(descriptor);

    expect(behavior).toMatchObject({
      check: "none",
      feedback: "none",
      layout: "hero",
      render: "static",
      validation: "none",
    });

    expect(hasStaticNavigation(descriptor)).toBe(false);
  });

  test("upgrades the practice scenario intro to the hero layout", () => {
    const descriptor = describePlayerStep(
      buildStep({ content: { text: "Hello", title: "Intro", variant: "intro" as const } }),
    );

    const behavior = getPlayerStepBehavior(descriptor);

    expect(behavior).toMatchObject({
      check: "none",
      feedback: "none",
      layout: "hero",
      render: "static",
      validation: "none",
    });

    expect(hasStaticNavigation(descriptor)).toBe(false);
  });

  test("routes investigation call through shared feedback and validation behavior", () => {
    const step = buildStep({
      content: {
        options: [
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

    expect(hasFeedbackScreen(descriptor)).toBe(true);
  });

  test("skips validation for investigation action while keeping its check behavior", () => {
    const step = buildStep({
      content: {
        options: [
          {
            feedback: "A clue",
            id: "action-1",
            quality: "critical" as const,
            text: "Inspect the logs",
          },
          {
            feedback: "Another clue",
            id: "action-2",
            quality: "useful" as const,
            text: "Interview the witness",
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
