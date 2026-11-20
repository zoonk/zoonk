import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { localePath, proofIn } from "./scenarios/configuration.mts";
import { SCENARIOS } from "./scenarios/scenarios.mts";

describe("a scenario's configuration: its language and text size", () => {
  it("loads a screen under its language's path, English at the root", () => {
    assert.deepEqual(
      [undefined, "en", "ja"].map((locale) => localePath("/plan", locale)),
      ["/plan", "/plan", "/ja/plan"],
    );
  });

  it("proves a screen in another language by the proof's own translation", () => {
    assert.equal(proofIn("Your path", "ja"), "学習の道のり");
    assert.equal(proofIn("Your path", "en"), "Your path");
    assert.throws(() => proofIn("Words no catalog has", "de"), /no de translation/u);
  });

  it("has a translation for every proof a scenario asks for in another language", () => {
    const asked = SCENARIOS.flatMap((scenario) =>
      scenario.sizes.flatMap(({ locale }) => (locale ? [[scenario.proof, locale]] : [])),
    );

    assert.ok(asked.length > 0);

    for (const [proof = "", locale] of asked) {
      assert.ok(proofIn(proof, locale));
    }
  });
});
