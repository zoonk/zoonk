import assert from "node:assert/strict";
import { describe, it } from "vitest";
import CASES from "./alignment-cases.json" with { type: "json" };
import { readCaptures } from "./alignment-validate.mts";

describe("the validator reads what the probes write", () => {
  it("reads every recorded capture, the column read's fills included, and refuses the two made to be", () => {
    const refused = Object.entries(CASES).flatMap(([name, capture]) =>
      readCaptures(capture).kind === "captures" ? [] : [name],
    );

    assert.deepEqual(refused, ["round 2 invalid-unit", "round 3 bad-specimen"]);
  });
});
