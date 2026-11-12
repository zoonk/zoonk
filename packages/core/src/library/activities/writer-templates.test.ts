import { describe, expect, it } from "vitest";
import { describeActivityTemplates } from "./writer-templates";

describe(describeActivityTemplates, () => {
  it("states a list's count as a target, not a limit", () => {
    const [processOrder] = describeActivityTemplates(["processOrder"]);
    const steps = JSON.parse(processOrder?.schema ?? "{}").properties.fields.properties.steps;

    expect(steps.description).toBe("Aim for 7 or fewer.");
    expect(steps.maxItems).toBeUndefined();
  });
});
