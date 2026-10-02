import { describe, expect, it } from "vitest";
import { checkValues, curvePeak, othersDiffer, sweepCurve } from "./parameter-model";

const angle = { initial: 30, label: "Angle", max: 90, min: 0, name: "angle", step: 1 };
const speed = { initial: 20, label: "Speed", max: 30, min: 5, name: "speed", step: 1 };
const variables = [angle, speed];

describe(checkValues, () => {
  it("starts every slider at its initial value and moves the ones the check names", () => {
    expect(checkValues(variables, [{ name: "angle", value: 45 }])).toStrictEqual({
      angle: 45,
      speed: 20,
    });
  });
});

describe(othersDiffer, () => {
  it("ignores the plotted slider", () => {
    const first = { angle: 30, speed: 20 };

    expect(othersDiffer({ first, second: { angle: 60, speed: 20 }, xName: "angle" })).toBe(false);
    expect(othersDiffer({ first, second: { angle: 30, speed: 25 }, xName: "angle" })).toBe(true);
  });
});

describe(sweepCurve, () => {
  const formula = "speed^2 * sin(rad(2 * angle)) / 9.81";

  it("sweeps the x slider and holds the others where they are", () => {
    const curve = sweepCurve({ formula, values: { angle: 10, speed: 20 }, x: angle });

    expect(curve[0]).toStrictEqual({ x: 0, y: 0 });
    expect(curve.at(-1)?.x).toBe(90);
    expect(curvePeak(curve)?.x).toBeCloseTo(45, 0);
    expect(curvePeak(curve)?.y).toBeCloseTo(400 / 9.81, 1);
  });

  it("changes shape when another slider moves", () => {
    const slow = curvePeak(sweepCurve({ formula, values: { angle: 30, speed: 10 }, x: angle }));
    const fast = curvePeak(sweepCurve({ formula, values: { angle: 30, speed: 20 }, x: angle }));

    expect((fast?.y ?? 0) / (slow?.y ?? 1)).toBeCloseTo(4, 5);
  });

  it("has no peak without points", () => {
    expect(curvePeak([])).toBeNull();
  });
});
