import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { contentStep, explanationStep, teachingStep } from "../../preview/preview-steps";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { getLessonOutline, getLessonRecap, getRecapMark } from "./lesson-aside";

function stateOf(
  steps: PlayableLibraryStep[],
  { position = 0, queue = steps.map((step) => step.id) } = {},
) {
  return {
    position,
    queue,
    retried: [],
    steps: Object.fromEntries(steps.map((step) => [step.id, step])),
  };
}

describe(getLessonOutline, () => {
  const hook = contentStep("hook", {
    content: { text: "Microwaves don't heat food from the inside.", variant: "text" },
  });

  const first = explanationStep({ text: "Water molecules spin.", title: "Molecules that spin" });
  const second = explanationStep({ text: "Spinning makes heat.", title: "From spin to heat" });
  const example = teachingStep("workedExample");
  const check = teachingStep("check");

  it("numbers the titled reading screens and marks the one in view and the ones read", () => {
    const outline = getLessonOutline(
      stateOf([hook, first, second, example, check], { position: 2 }),
    );

    expect(outline.rows).toStrictEqual([
      { id: first.id, number: 1, state: "read", title: "Molecules that spin" },
      { id: second.id, number: 2, state: "current", title: "From spin to heat" },
      { id: example.id, number: 3, state: "ahead", title: "Reading the cloud" },
    ]);

    expect(outline.questions).toBe(1);
  });

  it("counts a missed question that comes back at the end once", () => {
    const queue = [first.id, check.id, check.id];
    const outline = getLessonOutline(stateOf([first, check], { position: 2, queue }));

    expect(outline.rows).toStrictEqual([
      { id: first.id, number: 1, state: "read", title: "Molecules that spin" },
    ]);

    expect(outline.questions).toBe(1);
  });
});

function question(basis?: { position: number; quote: string }) {
  const content = { ...playableStepContent.check, basis: basis ?? null };
  return { ...contentStep("check", { content }), position: 3 };
}

function markOf(steps: PlayableLibraryStep[], step: PlayableLibraryStep) {
  const state = stateOf(steps, { position: steps.indexOf(step) });
  return getRecapMark({ recap: getLessonRecap(state), step });
}

describe(getRecapMark, () => {
  const quote = "It spreads out into a **cloud of possibilities**: a map of where it might be.";
  const explanation = { ...explanationStep(playableStepContent.explanation), position: 1 };
  const later = { ...explanationStep({ text: "Denser means likelier." }), position: 2 };

  it("marks the sentence a question rests on when the recap shows its screen", () => {
    const check = question({ position: 1, quote });
    expect(markOf([explanation, check], check)).toBe(quote);
  });

  it("marks nothing when the recap shows another screen, or the question has no basis", () => {
    const resting = question({ position: 1, quote });
    const plain = question();

    expect(markOf([explanation, later, resting], resting)).toBeNull();
    expect(markOf([explanation, plain], plain)).toBeNull();
  });
});
