import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { isNeutral } from "./contrast.mts";

describe("which text the regular look holds to WCAG AA", () => {
  it("is neutral text: the grays the design system's text tokens resolve to", () => {
    assert.ok(isNeutral("#737373"));
    assert.ok(isNeutral("#a1a1a1"));
  });

  it("isn't a soft colored mark or word, which stays soft until a device asks for more contrast", () => {
    assert.ok(!isNeutral("#60a5fa"));
    assert.ok(!isNeutral("#f472b6"));
    assert.ok(!isNeutral("#a78bfa"));
  });
});
