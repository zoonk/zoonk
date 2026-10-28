import { describe, expect, it } from "vitest";
import { getKeptBaseChoices } from "./chosen-bases";
import { getBaseChoices } from "./plan-bases";
import { type BaseChoice, type StoredBaseChoice, parsePlanSettings } from "./plan-state";

const ALL: BaseChoice[] = ["deep", "essential", "quick", "skip"];

/** Prokaryotes' core is studied, so only deep study is open; the membrane's every way is. */
const bases = [
  { choices: ["deep" as const], known: false, skillId: "prokaryotes" },
  { choices: ALL, known: false, skillId: "membrane" },
];

function chosen(choices: Record<string, StoredBaseChoice["choice"]>) {
  return getBaseChoices({
    bases,
    choices: Object.entries(choices).map(([skillId, choice]) => ({ choice, skillId })),
  });
}

// Class test seed 1255: the learner chose a quick lesson for prokaryotes, whose core they had
// studied. Kept, the choice planned the plan the way a plan with choices goes: work set aside came
// back, and cell theory left it. A choice the bases list doesn't open for a base changes nothing
// (R15): the base stays at its core, as studied.
describe(getBaseChoices, () => {
  it("takes no choice a base isn't open to: a studied core stays studied", () => {
    expect(chosen({ membrane: "quick", prokaryotes: "quick" })).toStrictEqual(
      new Map([
        ["prokaryotes", "essential"],
        ["membrane", "quick"],
      ]),
    );

    expect(chosen({ prokaryotes: "skip" }).get("prokaryotes")).toBe("essential");
  });

  it("keeps deep study of a base whose core the learner studied", () => {
    expect(chosen({ prokaryotes: "deep" }).get("prokaryotes")).toBe("deep");
  });
});

// A skip of a base the learner then missed a question on comes back to its core (R19).
describe(getKeptBaseChoices, () => {
  it("drops a skip of a base the learner missed", () => {
    expect(
      getKeptBaseChoices({
        missedSkillIds: new Set(["membrane"]),
        settings: parsePlanSettings({
          baseChoices: [
            { choice: "skip", skillId: "membrane" },
            { choice: "skip", skillId: "prokaryotes" },
          ],
        }),
      }),
    ).toStrictEqual([{ choice: "skip", skillId: "prokaryotes" }]);
  });
});
