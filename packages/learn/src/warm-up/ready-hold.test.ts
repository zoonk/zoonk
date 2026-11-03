import { describe, expect, it } from "vitest";
import { getReadyHold } from "./ready-hold";

const QUIET = { guessed: false, ready: true, released: false, touched: false };

describe(getReadyHold, () => {
  it("keeps waiting until what the learner waits for is ready, guess or not", () => {
    expect(getReadyHold({ ...QUIET, ready: false })).toBe("wait");
    expect(getReadyHold({ ...QUIET, guessed: true, ready: false, touched: true })).toBe("wait");
  });

  it("moves on as before for a learner who didn't guess and didn't touch the screen in the last second", () => {
    expect(getReadyHold(QUIET)).toBe("go");
  });

  it("waits out the quiet second after a touch, so the tap lands where it was aimed", () => {
    expect(getReadyHold({ ...QUIET, touched: true })).toBe("wait");
  });

  it("stays for a learner who guessed on this screen, before or during the quiet second", () => {
    expect(getReadyHold({ ...QUIET, guessed: true })).toBe("hold");
    expect(getReadyHold({ ...QUIET, guessed: true, touched: true })).toBe("hold");
  });

  it("moves on only once a learner who stayed presses the main button", () => {
    expect(getReadyHold({ ...QUIET, guessed: true, released: true, touched: true })).toBe("go");
  });
});
