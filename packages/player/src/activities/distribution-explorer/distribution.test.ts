import { describe, expect, it } from "vitest";
import {
  densityCurve,
  distributionDomain,
  distributionTicks,
  handleStep,
  snapDomain,
} from "./distribution";

const iq = { kind: "normal", mean: 100, sd: 15 } as const;
const dice = { kind: "uniform", max: 6, min: 0 } as const;

describe(densityCurve, () => {
  it("peaks at the mean of a normal curve, the same height on either side", () => {
    const curve = densityCurve(iq, [40, 160]);

    const heightAt = (value: number) =>
      curve.find((point) => Math.abs(point.x - value) < 1e-9)?.y ?? Number.NaN;

    expect(heightAt(100)).toBe(Math.max(...curve.map((point) => point.y)));
    expect(heightAt(85)).toBeCloseTo(heightAt(115));
  });
});

describe(distributionDomain, () => {
  it("covers three and a half SDs, stretched to reach the target and handles", () => {
    expect(
      distributionDomain({
        distribution: iq,
        handles: { from: 90, to: 110 },
        target: { from: 70, to: 130 },
      }),
    ).toStrictEqual([47.5, 152.5]);

    expect(
      distributionDomain({
        distribution: iq,
        handles: { from: 90, to: 110 },
        target: { from: 40, to: 130 },
      })[0],
    ).toBe(40);
  });
});

describe(handleStep, () => {
  it("lands on the target, the handles and whole SDs when it can", () => {
    const fields = {
      distribution: iq,
      handles: { from: 90, to: 110 },
      target: { from: 70, to: 130 },
    };

    expect(handleStep({ ...fields, domain: distributionDomain(fields) })).toBe(5);
  });

  it("gets finer when the target needs it", () => {
    const fields = {
      distribution: iq,
      handles: { from: 90, to: 110 },
      target: { from: 71, to: 130 },
    };

    expect(handleStep({ ...fields, domain: distributionDomain(fields) })).toBe(1);
  });
});

describe(snapDomain, () => {
  it("widens the axis to whole steps", () => {
    expect(snapDomain([47.5, 152.5], 5)).toStrictEqual([45, 155]);
  });
});

describe(densityCurve, () => {
  it("draws a uniform's straight walls", () => {
    const curve = densityCurve(dice, [-2, 8]);
    const heights = new Set(curve.map((point) => Number(point.y.toFixed(4))));

    expect(heights).toStrictEqual(new Set([0, Number((1 / 6).toFixed(4))]));
    expect(curve.some((point) => point.x > 5.999 && point.x < 6)).toBe(true);
  });
});

describe(distributionTicks, () => {
  it("labels the mean and whole SDs on a normal curve", () => {
    expect(distributionTicks(iq, [45, 155])).toStrictEqual([55, 70, 85, 100, 115, 130, 145]);
  });
});
