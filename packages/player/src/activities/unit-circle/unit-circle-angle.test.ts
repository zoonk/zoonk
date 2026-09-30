import { describe, expect, it } from "vitest";
import {
  angleAfterKey,
  angleStep,
  fromDegrees,
  piFraction,
  pointerAngle,
  toDegrees,
} from "./unit-circle-angle";

describe(angleStep, () => {
  it("moves in 5° steps when every named angle sits on them, finer otherwise", () => {
    expect(angleStep([0, 30, 150])).toBe(5);
    expect(angleStep([toDegrees(Math.PI / 6, "radians")])).toBe(5);
    expect(angleStep([toDegrees(0.5236, "radians")])).toBe(5);
    expect(angleStep([0, 42])).toBe(1);
    expect(angleStep([22.5])).toBe(0.5);
  });
});

describe(pointerAngle, () => {
  it("measures counterclockwise from the right, with y pointing down on screen", () => {
    const center = { x: 100, y: 100 };

    expect(pointerAngle(center, { x: 150, y: 100 })).toBe(0);
    expect(pointerAngle(center, { x: 100, y: 50 })).toBe(90);
    expect(pointerAngle(center, { x: 50, y: 100 })).toBe(180);
    expect(pointerAngle(center, { x: 100, y: 150 })).toBe(270);
  });
});

describe(angleAfterKey, () => {
  it("turns by a step, an eighth of a turn, or to either end, within one turn", () => {
    expect(angleAfterKey({ degrees: 30, key: "ArrowRight", step: 5 })).toBe(35);
    expect(angleAfterKey({ degrees: 30, key: "ArrowDown", step: 5 })).toBe(25);
    expect(angleAfterKey({ degrees: 30, key: "PageUp", step: 5 })).toBe(75);
    expect(angleAfterKey({ degrees: 355, key: "ArrowUp", step: 10 })).toBe(360);
    expect(angleAfterKey({ degrees: 30, key: "Home", step: 5 })).toBe(0);
    expect(angleAfterKey({ degrees: 30, key: "Enter", step: 5 })).toBeNull();
  });
});

describe(piFraction, () => {
  it("writes radians as the multiple of π people use", () => {
    expect(piFraction(150)).toBe("5π/6");
    expect(piFraction(180)).toBe("π");
    expect(piFraction(360)).toBe("2π");
    expect(piFraction(90)).toBe("π/2");
    expect(piFraction(0)).toBe("0");
    expect(piFraction(37)).toBeNull();
  });
});

describe(fromDegrees, () => {
  it("converts back to the lesson's unit", () => {
    expect(fromDegrees(180, "radians")).toBeCloseTo(Math.PI);
    expect(fromDegrees(45, "degrees")).toBe(45);
  });
});
