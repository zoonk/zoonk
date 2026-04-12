import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { describe, expect, test } from "vitest";
import { describePlayerStep, getInvestigationVariant, getStoryStaticVariant } from "./player-step";

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

describe(describePlayerStep, () => {
  test("describes story intro as its own canonical step", () => {
    const descriptor = describePlayerStep(
      buildStep({
        content: {
          intro: "Welcome",
          metrics: ["Morale"],
          variant: "storyIntro" as const,
        },
      }),
    );

    expect(descriptor?.kind).toBe("storyIntro");
    expect(getStoryStaticVariant(descriptor?.step)).toBe("storyIntro");
  });

  test("describes investigation call and preserves its investigation variant", () => {
    const descriptor = describePlayerStep(
      buildStep({
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
      }),
    );

    expect(descriptor?.kind).toBe("investigationCall");
    expect(getInvestigationVariant(descriptor?.step)).toBe("call");
  });

  test("keeps regular static text as the canonical staticText kind", () => {
    const descriptor = describePlayerStep(buildStep());

    expect(descriptor?.kind).toBe("staticText");
  });
});
