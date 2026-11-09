import { describe, expect, it } from "vitest";
import { getReadyHold } from "./ready-hold";

const QUIET = { engaged: false, ready: true, released: false, touched: false };

describe(getReadyHold, () => {
  it("keeps waiting until what the learner waits for is ready, played or not", () => {
    expect(getReadyHold({ ...QUIET, ready: false })).toBe("wait");
    expect(getReadyHold({ ...QUIET, engaged: true, ready: false, touched: true })).toBe("wait");
  });

  it("moves on as before for a learner who didn't play and didn't touch the screen in the last second", () => {
    expect(getReadyHold(QUIET)).toBe("go");
  });

  it("waits out the quiet second after a touch, so the tap lands where it was aimed", () => {
    expect(getReadyHold({ ...QUIET, touched: true })).toBe("wait");
  });

  it("stays for a learner who played or watched on this screen, before or during the quiet second", () => {
    expect(getReadyHold({ ...QUIET, engaged: true })).toBe("hold");
    expect(getReadyHold({ ...QUIET, engaged: true, touched: true })).toBe("hold");
  });

  it("moves on only once a learner who stayed presses the main button", () => {
    expect(getReadyHold({ ...QUIET, engaged: true, released: true, touched: true })).toBe("go");
  });
});
