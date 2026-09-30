import { describe, expect, it } from "vitest";
import { type TraceStep, type TracedValue } from "./program-runs";
import { findTraceMismatch } from "./trace-match";

const watch = ["total", "items", "done"];

function number(value: number): TracedValue {
  return { kind: "number", value };
}

/** A run of: total = 0 / for item in ...: total += item (twice) / done = True. */
const events: TraceStep[] = [
  { line: 1, values: [number(0), null, null] },
  { line: 2, values: [number(0), { kind: "text", text: "[ 2, 3 ]" }, null] },
  { line: 3, values: [number(2), { kind: "text", text: "[ 2, 3 ]" }, null] },
  { line: 2, values: [number(2), { kind: "text", text: "[ 2, 3 ]" }, null] },
  { line: 3, values: [number(5), { kind: "text", text: "[ 2, 3 ]" }, null] },
  { line: 4, values: [number(5), null, { kind: "boolean", value: true }] },
];

function mismatch(
  trace: { line: number; values: { name: string; value: boolean | number | string }[] }[],
) {
  return findTraceMismatch({ events, language: "python", trace, watch });
}

describe(findTraceMismatch, () => {
  it("accepts a trace that skips lines, however its values are written", () => {
    expect(
      mismatch([
        { line: 1, values: [{ name: "total", value: 0 }] },
        { line: 2, values: [{ name: "items", value: "[2, 3]" }] },
        { line: 3, values: [{ name: "total", value: "5" }] },
        { line: 4, values: [{ name: "done", value: "True" }] },
      ]),
    ).toBeNull();
  });

  it("keeps the order the lines ran", () => {
    expect(
      mismatch([
        { line: 4, values: [{ name: "done", value: true }] },
        { line: 1, values: [{ name: "total", value: 0 }] },
      ]),
    ).toStrictEqual({
      index: 1,
      message: "Step 2 is line 1, but running the code, line 1 doesn't run again after step 1",
    });
  });

  it("names the value a step gets wrong and what the run had", () => {
    expect(
      mismatch([
        { line: 1, values: [{ name: "total", value: 0 }] },
        { line: 3, values: [{ name: "total", value: 3 }] },
      ]),
    ).toStrictEqual({
      index: 1,
      message: "Step 2 is line 3 and shows total = 3, but running the code, it's 2 there",
    });
  });

  it("catches a value kept from an earlier step after the run changed it", () => {
    expect(
      mismatch([
        { line: 1, values: [{ name: "total", value: 0 }] },
        { line: 2, values: [{ name: "items", value: "[2, 3]" }] },
        { line: 3, values: [{ name: "items", value: "[2, 3]" }] },
      ]),
    ).toStrictEqual({
      index: 2,
      message:
        "Step 3 is line 3 and shows total = 0 (kept from an earlier step, so list its new value here), but running the code, it's 2 there",
    });
  });

  it("lets a kept value stand once its variable is gone", () => {
    expect(
      mismatch([
        { line: 2, values: [{ name: "items", value: "[2, 3]" }] },
        { line: 4, values: [{ name: "done", value: true }] },
      ]),
    ).toBeNull();
  });
});
