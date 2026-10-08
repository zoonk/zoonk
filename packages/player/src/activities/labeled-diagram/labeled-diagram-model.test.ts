import { describe, expect, it } from "vitest";
import {
  assignmentAnswer,
  mixUpFeedback,
  nextEmptySlot,
  orderSlots,
  placeName,
  removeName,
  unplacedNames,
} from "./labeled-diagram-model";

const drawing = {
  height: 200,
  parts: {
    apex: { anchor: [100, 180] as const },
    left: { anchor: [40, 100] as const },
    right: { anchor: [160, 96] as const },
    top: { anchor: [120, 30] as const, pin: [100, 20] as const },
  },
  width: 200,
};

const slots = orderSlots({
  drawing,
  parts: [
    { label: "Apex", partId: "apex" },
    { label: "Right", partId: "right" },
    { label: "Top", partId: "top" },
    { label: "Left", partId: "left" },
  ],
});

describe(orderSlots, () => {
  it("numbers spots by where their pins sit, top to bottom and left to right", () => {
    expect(slots.map((slot) => [slot.number, slot.partId])).toStrictEqual([
      [1, "top"],
      [2, "left"],
      [3, "right"],
      [4, "apex"],
    ]);
  });

  it("uses the pin, not the anchor, for offset parts and describes where each sits", () => {
    expect(slots[0]).toMatchObject({ anchor: [120, 30], pin: [100, 20], position: "top" });
    expect(slots.map((slot) => slot.position)).toStrictEqual(["top", "left", "right", "bottom"]);
  });

  it("leaves out parts the drawing doesn't have", () => {
    expect(orderSlots({ drawing, parts: [{ label: "Tail", partId: "tail" }] })).toStrictEqual([]);
  });
});

describe(placeName, () => {
  it("moves a name that was already on another part", () => {
    const placements = placeName({ name: "Top", partId: "left", placements: { top: "Top" } });
    expect(placements).toStrictEqual({ left: "Top" });
  });

  it("replaces the name on the part, sending the old one back to the bank", () => {
    const placements = placeName({ name: "Left", partId: "top", placements: { top: "Top" } });

    expect(placements).toStrictEqual({ top: "Left" });
    expect(unplacedNames(["Top", "Left", "Valve"], placements)).toStrictEqual(["Top", "Valve"]);
  });
});

describe(nextEmptySlot, () => {
  it("finds the next empty spot after the current one, wrapping around", () => {
    expect(nextEmptySlot({ after: "left", placements: { right: "R" }, slots })).toBe("apex");
    expect(nextEmptySlot({ after: "apex", placements: { right: "R" }, slots })).toBe("top");
    expect(nextEmptySlot({ after: null, placements: {}, slots })).toBe("top");
  });

  it("returns null once every spot has a name", () => {
    const full = { apex: "A", left: "L", right: "R", top: "T" };
    expect(nextEmptySlot({ after: "top", placements: full, slots })).toBeNull();
  });
});

describe(assignmentAnswer, () => {
  it("answers only when every spot has a name", () => {
    const partial = { left: "Left", top: "Top" };
    expect(assignmentAnswer(slots, partial)).toBeNull();

    const full = { ...partial, apex: "Apex", right: "Right" };
    expect(assignmentAnswer(slots, full)).toStrictEqual({ kind: "assignment", pairs: full });
    expect(assignmentAnswer(slots, removeName(full, "apex"))).toBeNull();
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
