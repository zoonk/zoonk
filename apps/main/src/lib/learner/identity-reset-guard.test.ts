import { describe, expect, it } from "vitest";
import { type IdentityTransition } from "./identity-cover";
import {
  type IdentityResetState,
  decideIdentityReset,
  parseIdentityResetGuard,
} from "./identity-reset-guard";

const FRESH: IdentityResetState = {
  consumed: null,
  decided: false,
  manual: null,
  readFailed: false,
  removeFailed: false,
};

const L_TO_M: IdentityTransition = { contaminated: false, from: "t1.tag-of-l", to: "t1.tag-of-m" };
const L_TO_NOBODY: IdentityTransition = { contaminated: false, from: "t1.tag-of-l", to: null };

/** Every decision the store makes in one document, in order, and whether each may reload. */
function decideAll(state: IdentityResetState, transitions: (IdentityTransition | null)[]) {
  return transitions.reduce<{ automatic: boolean[]; state: IdentityResetState }>(
    (done, transition) => {
      const decision = decideIdentityReset({ state: done.state, transition });
      return { automatic: [...done.automatic, decision.automatic], state: decision.state };
    },
    { automatic: [], state },
  );
}

describe(parseIdentityResetGuard, () => {
  it("reads the guard a reset wrote", () => {
    const raw = JSON.stringify({ ...L_TO_M, version: 1 });
    expect(parseIdentityResetGuard(raw)).toStrictEqual(L_TO_M);
  });

  it("reads a reset to nobody of a page drawn for two learners", () => {
    const raw = JSON.stringify({ contaminated: true, from: null, to: null, version: 1 });

    expect(parseIdentityResetGuard(raw)).toStrictEqual({
      contaminated: true,
      from: null,
      to: null,
    });
  });

  it.each([
    ["no guard", null],
    ["a broken string", "{"],
    ["another version", JSON.stringify({ ...L_TO_M, version: 2 })],
    ["a missing field", JSON.stringify({ from: "t1.tag-of-l", to: "t1.tag-of-m", version: 1 })],
    ["an empty learner", JSON.stringify({ ...L_TO_M, from: "", version: 1 })],
    ["a number for a learner", JSON.stringify({ ...L_TO_M, to: 7, version: 1 })],
    ["not an object", JSON.stringify("t1.tag-of-l")],
  ])("finds no guard in %s", (_case, raw) => {
    expect(parseIdentityResetGuard(raw)).toBeNull();
  });
});

describe(decideIdentityReset, () => {
  it("reloads on its own when no reload came before", () => {
    expect(decideAll(FRESH, [L_TO_M]).automatic).toStrictEqual([true]);
  });

  it("asks for a reload when the reload before ended in the same reset, and keeps asking", () => {
    const { automatic } = decideAll({ ...FRESH, consumed: L_TO_M }, [L_TO_M, L_TO_M]);
    expect(automatic).toStrictEqual([false, false]);
  });

  it("reloads on its own when the reload before was for another reset", () => {
    const { automatic } = decideAll({ ...FRESH, consumed: L_TO_NOBODY }, [L_TO_M, L_TO_NOBODY]);
    expect(automatic).toStrictEqual([true, true]);
  });

  it("keeps only the repeated reset manual", () => {
    const { automatic } = decideAll({ ...FRESH, consumed: L_TO_M }, [L_TO_M, L_TO_NOBODY]);
    expect(automatic).toStrictEqual([false, true]);
  });

  it("reloads on its own again once the first decision uncovered the page", () => {
    const { automatic } = decideAll({ ...FRESH, consumed: L_TO_M }, [null, L_TO_M]);
    expect(automatic).toStrictEqual([false, true]);
  });

  it.each([
    ["couldn't be read", { readFailed: true }],
    ["couldn't be removed", { removeFailed: true }],
  ])("never reloads on its own when the guard %s", (_case, failure) => {
    const { automatic } = decideAll({ ...FRESH, ...failure }, [L_TO_M, L_TO_NOBODY]);
    expect(automatic).toStrictEqual([false, false]);
  });
});
