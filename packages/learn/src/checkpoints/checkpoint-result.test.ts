import { describe, expect, it } from "vitest";
import { getEarnedBrainPower, getResultRows, hasResultRows } from "./checkpoint-result";

const NEXT = { index: 1, name: "Cells" };

function checkpoint({
  kind = "boss",
  nextPhase = NEXT,
  phaseComplete = false,
  retry = null,
  badge = false,
}: {
  badge?: boolean;
  kind?: "boss" | "weekly";
  nextPhase?: typeof NEXT | null;
  phaseComplete?: boolean;
  retry?: "open" | "passed" | "tomorrow" | null;
} = {}) {
  return {
    kind,
    nextPhase,
    retry,
    reward: { badge, brainPower: 30, glasses: null, phaseComplete },
  };
}

describe(getResultRows, () => {
  it("leaves a won weekly challenge with no rows, so the result has nothing beside it", () => {
    const rows = getResultRows({
      checkpoint: checkpoint({ kind: "weekly" }),
      hasRetry: false,
      won: true,
    });

    expect(hasResultRows(rows)).toBe(false);
  });

  it("lists only the badge after a win: Continue leads on to the next lessons", () => {
    const rows = getResultRows({
      checkpoint: checkpoint({ badge: true, phaseComplete: true }),
      hasRetry: false,
      won: true,
    });

    expect(rows).toStrictEqual({ badge: true, nextLessonsOpen: false, retry: false });
  });

  it("lists a loss's rematch and the already open next lessons", () => {
    const rows = getResultRows({
      checkpoint: checkpoint({ retry: "tomorrow" }),
      hasRetry: true,
      won: false,
    });

    expect(rows).toStrictEqual({ badge: false, nextLessonsOpen: true, retry: true });
  });

  it("drops the next lessons after a loss a rematch won", () => {
    const rows = getResultRows({
      checkpoint: checkpoint({ nextPhase: NEXT, retry: "passed" }),
      hasRetry: true,
      won: false,
    });

    expect(rows.nextLessonsOpen).toBe(false);
    expect(hasResultRows(rows)).toBe(true);
  });
});

describe(getEarnedBrainPower, () => {
  const completion = { brainPower: 50, fullMeal: { bonus: 20, paid: true } };

  it("leaves out the missions' bonus the duel paid", () => {
    expect(getEarnedBrainPower({ completion, prize: 30, won: true })).toBe(30);
  });

  it("shows a reopened win's prize and a reopened loss's nothing", () => {
    expect(getEarnedBrainPower({ completion: null, prize: 30, won: true })).toBe(30);
    expect(getEarnedBrainPower({ completion: null, prize: 30, won: false })).toBe(0);
  });
});
