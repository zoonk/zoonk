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
});
