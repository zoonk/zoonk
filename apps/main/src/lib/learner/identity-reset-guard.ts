import { type IdentityTransition } from "./identity-cover";

/** Where a reload leaves the reset it was for, for the next document (`sessionStorage`). */
export const IDENTITY_RESET_GUARD_KEY = "zoonk:identity-reset";

/**
 * What the cover remembers about resets in this document: the guard the page found when it loaded
 * (`consumed`, until the first decision), whether that first decision was made, the reset that
 * must stay manual because the reload before it ended in the same one (`manual`), and whether
 * reading or removing the guard failed, which keeps every reset manual (a reload loop otherwise).
 */
export type IdentityResetState = {
  consumed: IdentityTransition | null;
  decided: boolean;
  manual: IdentityTransition | null;
  readFailed: boolean;
  removeFailed: boolean;
};

/**
 * The one check of the reset guard a reload leaves in `sessionStorage` (the tags the page was
 * drawn for and the browser held), which this document's cover reads at parse time and writes
 * before reloading. Anything else (another version, a missing
 * field, a broken string) is no guard at all. It runs inside the parse-time bootstrap, so it uses
 * nothing outside itself.
 */
export function parseIdentityResetGuard(raw: string | null): IdentityTransition | null {
  if (raw === null) {
    return null;
  }

  try {
    const guard: unknown = JSON.parse(raw);

    if (
      typeof guard !== "object" ||
      guard === null ||
      !("from" in guard) ||
      !("contaminated" in guard) ||
      !("to" in guard) ||
      !("version" in guard)
    ) {
      return null;
    }

    const { contaminated, from, to, version } = guard;

    return version === 1 &&
      typeof contaminated === "boolean" &&
      (from === null || (typeof from === "string" && from.length > 0)) &&
      (to === null || (typeof to === "string" && to.length > 0))
      ? { contaminated, from, to }
      : null;
  } catch {
    return null;
  }
}

/**
 * Whether a reset the store decided may reload the page on its own. The first decision after a
 * reload that ends in the same reset as the guard it found stays manual (and so does that reset
 * from then on): the reload didn't help, and reloading again would loop. A first decision that
 * lifts a cover instead (`transition: null`) lets later resets reload on their own. A guard this
 * document couldn't read or remove keeps every reset manual. It runs inside the parse-time
 * bootstrap, so it uses nothing outside itself.
 */
export function decideIdentityReset({
  state,
  transition,
}: {
  state: IdentityResetState;
  transition: IdentityTransition | null;
}): { automatic: boolean; state: IdentityResetState } {
  const earlier = state.decided ? state.manual : state.consumed;

  const repeated =
    earlier !== null &&
    transition !== null &&
    earlier.from === transition.from &&
    earlier.to === transition.to &&
    earlier.contaminated === transition.contaminated;

  return {
    automatic: transition !== null && !repeated && !state.readFailed && !state.removeFailed,
    state: state.decided
      ? state
      : { ...state, consumed: null, decided: true, manual: repeated ? transition : null },
  };
}
