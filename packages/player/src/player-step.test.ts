import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { describe, expect, test } from "vitest";
import { describePlayerStep, getPlayerStepImage } from "./player-step";

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
  test("describes practice scenario as the canonical intro step", () => {
    const descriptor = describePlayerStep(
      buildStep({ content: { text: "Hello", title: "Intro", variant: "intro" as const } }),
    );

    expect(descriptor?.kind).toBe("intro");
    expect(descriptor?.kind === "intro" ? descriptor.intro.title : null).toBe("Intro");
    expect(descriptor?.kind === "intro" ? descriptor.intro.text : null).toBe("Hello");
  });

  test("keeps regular static text as the canonical staticText kind", () => {
    const descriptor = describePlayerStep(buildStep());

    expect(descriptor?.kind).toBe("staticText");
  });

  test("returns the primary image from image-backed descriptors", () => {
    const image = { prompt: "A useful diagram", url: "data:image/svg+xml,diagram" };
    const staticDescriptor = describePlayerStep(
      buildStep({ content: { image, text: "Hello", title: "Intro", variant: "text" as const } }),
    );
    const choiceDescriptor = describePlayerStep(
      buildStep({
        content: {
          image,
          kind: "core" as const,
          options: [{ feedback: "Correct", id: "A", isCorrect: true, text: "A" }],
          question: "Choose",
        },
        kind: "multipleChoice",
      }),
    );

    expect(getPlayerStepImage(staticDescriptor)).toEqual(image);
    expect(getPlayerStepImage(choiceDescriptor)).toEqual(image);
    expect(getPlayerStepImage(null)).toBeNull();
  });
});
