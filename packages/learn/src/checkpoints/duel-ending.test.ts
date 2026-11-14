import { describe, expect, it } from "vitest";
import { getShieldCracks, getVerdictAct } from "./duel-ending";

describe(getShieldCracks, () => {
  it("leaves the shield whole until the first right answer", () => {
    expect(getShieldCracks({ broken: 0, segments: 7 })).toBe(0);
  });

  it("cracks it once with the first right answer, twice from half the pass mark", () => {
    expect(getShieldCracks({ broken: 1, segments: 7 })).toBe(1);
    expect(getShieldCracks({ broken: 3, segments: 7 })).toBe(1);
    expect(getShieldCracks({ broken: 4, segments: 7 })).toBe(2);
    expect(getShieldCracks({ broken: 6, segments: 7 })).toBe(2);
  });
});

describe(getVerdictAct, () => {
  it("plays the duel's ending on the answer that decides it", () => {
    expect(getVerdictAct({ decision: "won", isCorrect: true })).toBe("defeat");
    expect(getVerdictAct({ decision: "lost", isCorrect: false })).toBe("triumph");
  });

  it("reacts to an answer that decides nothing", () => {
    expect(getVerdictAct({ decision: null, isCorrect: true })).toBe("sly");
    expect(getVerdictAct({ decision: null, isCorrect: false })).toBe("smug");
  });
});
