import { assembleChallengeCase, draftEmptyScript } from "@zoonk/ai/tasks/challenge/assemble";
import { challengePlanFixture } from "@zoonk/ai/tasks/challenge/plan-fixture";
import { describe, expect, it } from "vitest";
import { applyChallengeEdits } from "./challenge-edits";

function written() {
  const plan = challengePlanFixture();
  return assembleChallengeCase({ plan, script: draftEmptyScript(plan) }).written;
}

describe(applyChallengeEdits, () => {
  it("replaces each edit's one occurrence in order and leaves the rest as it was", () => {
    const original = written();

    const fixed = applyChallengeEdits({
      edits: [
        { find: "Day 3", replace: "Day 4" },
        { find: "Day 4 at", replace: "$& the new" },
      ],
      written: original,
    });

    expect(fixed).toStrictEqual({ ...original, setting: "$& the new Aurora Shop" });
  });

  it("fails the whole fix when an edit's text isn't in the case", () => {
    expect(
      applyChallengeEdits({
        edits: [
          { find: "Day 3", replace: "Day 4" },
          { find: "Day 9", replace: "Day 10" },
        ],
        written: written(),
      }),
    ).toBeNull();
  });

  it("fails the whole fix when an edit's text occurs more than once", () => {
    expect(
      applyChallengeEdits({ edits: [{ find: "-", replace: "+" }], written: written() }),
    ).toBeNull();
  });

  it.each([
    ["renames a choice id", { find: "skip", replace: "renamed-choice" }],
    ["flips what a meter counts as good", { find: "low", replace: "high" }],
    ["sets a meter to a value it can't have", { find: "low", replace: "lower" }],
    ["sends a choice to another ending", { find: "unclear", replace: "sent" }],
  ])("fails an edit that %s instead of changing words learners read", (_label, edit) => {
    expect(applyChallengeEdits({ edits: [edit], written: written() })).toBeNull();
  });

  it("fails an edit with no text to find", () => {
    expect(
      applyChallengeEdits({ edits: [{ find: "", replace: "x" }], written: written() }),
    ).toBeNull();
  });
});
