import { describe, expect, it } from "vitest";
import { resolveExperienceMode } from "./experience-mode";

describe(resolveExperienceMode, () => {
  it("uses the profile's mode for signed-in learners", () => {
    expect(resolveExperienceMode({ guestModeCookie: "focus", profileMode: "fun" })).toBe("fun");
    expect(resolveExperienceMode({ guestModeCookie: "fun", profileMode: "focus" })).toBe("focus");
  });

  it("uses the cookie for guests", () => {
    expect(resolveExperienceMode({ guestModeCookie: "fun", profileMode: null })).toBe("fun");
    expect(resolveExperienceMode({ guestModeCookie: "focus" })).toBe("focus");
  });

  it("falls back to Focus when nothing valid was chosen", () => {
    expect(resolveExperienceMode({})).toBe("focus");
    expect(resolveExperienceMode({ guestModeCookie: null, profileMode: null })).toBe("focus");
    expect(resolveExperienceMode({ guestModeCookie: "FUN" })).toBe("focus");
    expect(resolveExperienceMode({ guestModeCookie: "party" })).toBe("focus");
  });
});
