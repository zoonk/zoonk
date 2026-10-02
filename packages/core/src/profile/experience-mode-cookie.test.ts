import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearExperienceModeCookie,
  readExperienceModeCookie,
  writeExperienceModeCookie,
} from "./experience-mode-cookie";

describe(readExperienceModeCookie, () => {
  it("reads the mode wherever the cookie sits among others", () => {
    expect(readExperienceModeCookie("zoonk_mode=fun")).toBe("fun");
    expect(readExperienceModeCookie("NEXT_LOCALE=pt; zoonk_mode=focus; theme=x")).toBe("focus");
    expect(readExperienceModeCookie("a=1;zoonk_mode=fun")).toBe("fun");
  });

  it("ignores cookies that only look like it and values that aren't a mode", () => {
    expect(readExperienceModeCookie("")).toBeNull();
    expect(readExperienceModeCookie("old_zoonk_mode=fun")).toBeNull();
    expect(readExperienceModeCookie("zoonk_mode_hint=fun")).toBeNull();
    expect(readExperienceModeCookie("zoonk_mode=funny")).toBeNull();
    expect(readExperienceModeCookie("zoonk_mode=")).toBeNull();
  });
});

describe("the browser's copy", () => {
  /** Tests run without a browser; a plain `cookie` field shows what the browser would be told. */
  beforeEach(() => {
    vi.stubGlobal("document", { cookie: "" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the mode for the whole site for a year, as the reader expects it", () => {
    writeExperienceModeCookie("fun");

    expect(readExperienceModeCookie(document.cookie)).toBe("fun");
    expect(document.cookie).toContain("Path=/");
    expect(document.cookie).toContain("Max-Age=31536000");
  });

  it("forgets the mode for the whole site", () => {
    clearExperienceModeCookie();

    expect(readExperienceModeCookie(document.cookie)).toBeNull();
    expect(document.cookie).toMatch(/^zoonk_mode=;/u);
    expect(document.cookie).toContain("Max-Age=0");
    expect(document.cookie).toContain("Path=/");
  });
});
