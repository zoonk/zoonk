import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { unitCircleTemplate } from "./geometry";

describe("unit circle values", () => {
  const { fields } = activityContentFixtures.unitCircle;
  const circle = { ...fields, show: ["sin", "cos", "tan"] };

  const valueAt = (angle: number, output: string) =>
    unitCircleTemplate.computeValue(circle, { inputs: { angle }, output });

  it.each([
    [180, "sin"],
    [180, "tan"],
    [270, "cos"],
    [360, "sin"],
    [360, "tan"],
  ])("reads %d° %s as 0, not what rounding π leaves", (angle, output) => {
    expect(valueAt(angle, output)).toBe(0);
  });

  it("has no tangent where it doesn't exist", () => {
    expect(valueAt(90, "tan")).toBeNull();
  });
});
