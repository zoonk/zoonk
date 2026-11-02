import { engineModeFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { startingModel } from "./formula-model-view";

const content = { ...engineModeFixtures.formulaModel.scenario, template: "formulaModel" as const };

describe(startingModel, () => {
  it("opens at the check's inputs only once the screen is checked", () => {
    expect(startingModel({ content, phase: "answering" })).toStrictEqual({
      events: { rentUp: 0 },
      sliders: { price: 3 },
    });

    expect(startingModel({ content, phase: "checked" })).toStrictEqual({
      events: { rentUp: 1 },
      sliders: { price: 4 },
    });
  });
});
