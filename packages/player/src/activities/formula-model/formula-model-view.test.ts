import { engineModeFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { formatLocalizedNumber } from "@zoonk/utils/localized-number";
import { describe, expect, it } from "vitest";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { type ModelValues } from "../_utils/formula-model";
import { modelView, startingModel } from "./formula-model-view";

const content = { ...engineModeFixtures.formulaModel.scenario, template: "formulaModel" as const };

const simulation = {
  ...engineModeFixtures.formulaModel.simulation,
  template: "formulaModel" as const,
};

function viewAt(
  model: Parameters<typeof modelView>[0]["content"],
  { events = {}, sliders }: { events?: ModelValues; sliders: ModelValues },
) {
  const [axis] = model.fields.variables;
  const [charted] = model.fields.outputs;

  if (!axis || !charted) {
    throw new Error("The model needs a variable and an output");
  }

  return modelView({
    axis,
    charted,
    content: model,
    events,
    outputAt: (output, at) => computeActivityValue(model, { inputs: at, output: output.id }),
    sliders,
  });
}

function line(initial: number) {
  return {
    ...simulation,
    fields: {
      outputs: [{ formula: "x", id: "x", label: "Position", unit: "m" }],
      variables: [{ initial, label: "Position", max: 10, min: -10, name: "x", step: 0.005 }],
    },
  };
}

function changes(view: ReturnType<typeof modelView>) {
  return Object.fromEntries(
    view.readouts.map(({ change, output }) => [
      output.id,
      change &&
        formatLocalizedNumber({
          locale: "en",
          maximumFractionDigits: change.digits,
          signed: true,
          value: change.amount,
        }),
    ]),
  );
}

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

describe(modelView, () => {
  it("has no change for a readout that rounds to its starting value", () => {
    expect(changes(viewAt(simulation, { sliders: { angle: 60, speed: 20 } }))).toStrictEqual({
      distance: null,
      peak: "+10.2",
    });
  });

  it("reads each change off the rounded readouts", () => {
    expect(changes(viewAt(simulation, { sliders: { angle: 45, speed: 20 } }))).toStrictEqual({
      distance: "+5.5",
      peak: "+5.1",
    });
  });

  it("keeps a readout's float noise out of the change", () => {
    const { distance } = changes(viewAt(simulation, { sliders: { angle: 90, speed: 20 } }));
    expect(distance).toBe("\u221235.3");
  });

  it("rounds a readout as it's written and keeps its decimals in the change", () => {
    expect(changes(viewAt(line(1), { sliders: { x: 1.005 } })).x).toBe("+0.01");
    expect(changes(viewAt(line(-9.99), { sliders: { x: 9.99 } })).x).toBe("+19.98");
  });

  it("has no what-if change when the event leaves the readout the same", () => {
    const model = {
      ...simulation,
      fields: {
        ...simulation.fields,
        events: [{ label: "Mirror the angle", name: "mirror" }],
        outputs: simulation.fields.outputs.map((output) =>
          output.id === "distance"
            ? { ...output, formula: "speed^2 * sin(rad(2 * angle + 60 * mirror)) / 9.81" }
            : output,
        ),
      },
    };

    const view = viewAt(model, { events: { mirror: 1 }, sliders: { angle: 30, speed: 20 } });

    expect(view.delta).toBeNull();
    expect(changes(view)).toStrictEqual({ distance: null, peak: null });
  });
});
