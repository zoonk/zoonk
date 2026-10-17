import { describe, expect, it } from "vitest";
import { blockingPause, firstStep, tracerAnswer, watchedValues } from "./tracer-steps";

const trace = [
  {
    line: 1,
    values: [
      { name: "lo", value: 0 },
      { name: "hi", value: 7 },
    ],
  },
  {
    line: 3,
    values: [
      { name: "lo", value: 0 },
      { name: "mid", value: 3 },
    ],
  },
  {
    line: 3,
    values: [
      { name: "lo", value: 4 },
      { name: "mid", value: 5 },
    ],
  },
  {
    line: 3,
    values: [
      { name: "lo", value: 6 },
      { name: "mid", value: 6 },
    ],
  },
];

describe(watchedValues, () => {
  it("carries a value forward until a step changes it, and marks the change", () => {
    expect(watchedValues({ step: 2, trace, watch: ["lo", "hi", "mid"] })).toStrictEqual([
      { changed: true, name: "lo", previous: "0", value: "4" },
      { changed: false, name: "hi", previous: "7", value: "7" },
      { changed: true, name: "mid", previous: "3", value: "5" },
    ]);
  });

  it("has no values before the first step and nothing changed on it", () => {
    expect(watchedValues({ step: -1, trace, watch: ["lo"] })).toStrictEqual([
      { changed: false, name: "lo", previous: null, value: null },
    ]);

    expect(watchedValues({ step: 0, trace, watch: ["mid"] })).toStrictEqual([
      { changed: false, name: "mid", previous: null, value: null },
    ]);
  });
});

describe(blockingPause, () => {
  const pauses = [{ step: 3 }];

  it("stops stepping into a paused step until there's a prediction", () => {
    expect(blockingPause({ pauses, predictions: {}, step: 2 })).toStrictEqual({
      index: 0,
      pause: { step: 3 },
    });

    expect(blockingPause({ pauses, predictions: { 0: "b" }, step: 2 })).toBeNull();
    expect(blockingPause({ pauses, predictions: {}, step: 1 })).toBeNull();
  });
});

describe(firstStep, () => {
  it("starts before the first line when the first line itself is a pause", () => {
    expect(firstStep([{ step: 3 }])).toBe(0);
    expect(firstStep([{ step: 0 }])).toBe(-1);
  });
});

describe(tracerAnswer, () => {
  it("answers once every pause has a prediction", () => {
    expect(tracerAnswer([{ step: 1 }, { step: 3 }], { 0: "a" })).toBeNull();

    expect(tracerAnswer([{ step: 1 }, { step: 3 }], { 0: "a", 1: "c" })).toStrictEqual({
      kind: "assignment",
      pairs: { 0: "a", 1: "c" },
    });
  });
});
