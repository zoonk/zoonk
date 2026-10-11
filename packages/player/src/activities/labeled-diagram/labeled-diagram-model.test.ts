import { describe, expect, it } from "vitest";
import {
  assignmentAnswer,
  diagramSlots,
  mixUpFeedback,
  nextEmptySlot,
  placeName,
  removeName,
  unplacedNames,
} from "./labeled-diagram-model";

const slots = diagramSlots([
  { label: "Aorta" },
  { label: "Right atrium" },
  { label: "Left atrium" },
  { label: "Left ventricle" },
]);

describe(diagramSlots, () => {
  it("numbers the spots in the picture's order, the first part as 1", () => {
    expect(slots.map((slot) => [slot.number, slot.key, slot.label])).toStrictEqual([
      [1, "1", "Aorta"],
      [2, "2", "Right atrium"],
      [3, "3", "Left atrium"],
      [4, "4", "Left ventricle"],
    ]);
  });
});

describe(placeName, () => {
  it("moves a name that was already on another spot", () => {
    const placements = placeName({ key: "2", name: "Aorta", placements: { "1": "Aorta" } });
    expect(placements).toStrictEqual({ "2": "Aorta" });
  });

  it("replaces the name on the spot, sending the old one back to the bank", () => {
    const placements = placeName({ key: "1", name: "Valve", placements: { "1": "Aorta" } });

    expect(placements).toStrictEqual({ "1": "Valve" });

    expect(unplacedNames(["Aorta", "Valve", "Septum"], placements)).toStrictEqual([
      "Aorta",
      "Septum",
    ]);
  });
});

describe(nextEmptySlot, () => {
  it("finds the next empty spot after the current one, wrapping around", () => {
    expect(nextEmptySlot({ after: "2", placements: { "3": "L" }, slots })).toBe("4");
    expect(nextEmptySlot({ after: "4", placements: { "3": "L" }, slots })).toBe("1");
    expect(nextEmptySlot({ after: null, placements: {}, slots })).toBe("1");
  });

  it("returns null once every spot has a name", () => {
    const full = { "1": "A", "2": "R", "3": "L", "4": "V" };
    expect(nextEmptySlot({ after: "1", placements: full, slots })).toBeNull();
  });
});

describe(assignmentAnswer, () => {
  it("answers only when every spot has a name", () => {
    const partial = { "1": "Aorta", "2": "Right atrium" };
    expect(assignmentAnswer(slots, partial)).toBeNull();

    const full = { ...partial, "3": "Left atrium", "4": "Left ventricle" };
    expect(assignmentAnswer(slots, full)).toStrictEqual({ kind: "assignment", pairs: full });
    expect(assignmentAnswer(slots, removeName(full, "4"))).toBeNull();
  });
});

describe(mixUpFeedback, () => {
  const mixUps = [{ feedback: "It faces you.", labels: ["Right atrium", "Left atrium"] }];

  it("gives the feedback for exactly the mix-up the learner made", () => {
    expect(mixUpFeedback({ correct: "Right atrium", mixUps, placed: "Left atrium" })).toBe(
      "It faces you.",
    );

    expect(mixUpFeedback({ correct: "Right atrium", mixUps, placed: "Aorta" })).toBeNull();
    expect(mixUpFeedback({ correct: "Right atrium", mixUps, placed: "Right atrium" })).toBeNull();
    expect(mixUpFeedback({ correct: "Right atrium", mixUps, placed: undefined })).toBeNull();
  });
});
