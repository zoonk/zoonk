import { describe, expect, it } from "vitest";
import { describeSessionHint } from "./session-hint";

describe(describeSessionHint, () => {
  it("reads a learner's tag and a session from before tags as a session", () => {
    expect(describeSessionHint("t1.AbCdEfGhIjKlMnOpQrSt-_")).toBe("session");
    expect(describeSessionHint("1")).toBe("session");
  });

  it("reads 0 as no session", () => {
    expect(describeSessionHint("0")).toBe("none");
  });

  it.each([
    null,
    undefined,
    "",
    "yes",
    "t1.",
    "t1.AbCdEfGhIjKlMnOpQrSt-",
    "t1.AbCdEfGhIjKlMnOpQrSt-_x",
    "t1.AbCdEfGhIjKlMnOpQrSt+/",
    "t2.AbCdEfGhIjKlMnOpQrSt-_",
    " t1.AbCdEfGhIjKlMnOpQrSt-_",
  ])("knows nothing from an absent, malformed or unknown-version hint (%j)", (value) => {
    expect(describeSessionHint(value)).toBe("unknown");
  });
});
