import { assembleChallengeCase, draftEmptyScript } from "@zoonk/ai/tasks/challenge/assemble";
import { challengePlanFixture } from "@zoonk/ai/tasks/challenge/plan-fixture";
import { describe, expect, it } from "vitest";
import { checkWrittenChallenge } from "./challenge-case-content";
import { applyChallengeEdits } from "./challenge-edits";

function written() {
  const plan = challengePlanFixture();
  return assembleChallengeCase({ plan, script: draftEmptyScript(plan) }).written;
}

function nextOf(fixed: ReturnType<typeof written> | null, choiceId: string) {
  return fixed?.nodes.flatMap((node) => node.choices).find((choice) => choice.id === choiceId)
    ?.next;
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
  ])("fails an edit that %s instead of changing words learners read", (_label, edit) => {
    expect(applyChallengeEdits({ edits: [edit], written: written() })).toBeNull();
  });

  it("lets edits send choices to other existing endings, for the content check to judge", () => {
    const fixed = applyChallengeEdits({
      edits: [
        { find: "a sentence", replace: "one line" },
        { find: "sent", replace: "pending" },
        { find: "unclear", replace: "sent" },
        { find: "pending", replace: "unclear" },
      ],
      written: written(),
    });

    expect(nextOf(fixed, "plain")).toBe("unclear");
    expect(nextOf(fixed, "short")).toBe("sent");

    expect(
      fixed && checkWrittenChallenge({ variant: "work", written: fixed }).problems,
    ).toStrictEqual([]);
  });

  it("fails an edit with no text to find", () => {
    expect(
      applyChallengeEdits({ edits: [{ find: "", replace: "x" }], written: written() }),
    ).toBeNull();
  });
});
