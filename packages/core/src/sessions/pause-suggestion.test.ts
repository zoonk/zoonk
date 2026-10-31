import { describe, expect, it } from "vitest";
import { shouldSuggestPause } from "./pause-suggestion";

describe(shouldSuggestPause, () => {
  it("suggests a pause when accuracy drops sharply after a good start", () => {
    const answers = [true, true, true, true, false, true, false, false, false, false, false];
    expect(shouldSuggestPause(answers)).toBe(true);
  });

  it("stays quiet on a hard session that was never going well, or a short one", () => {
    expect(
      shouldSuggestPause([false, true, false, false, true, false, false, false, false, false]),
    ).toBe(false);

    expect(shouldSuggestPause([true, false, false, false, false, false])).toBe(false);
  });

  it("stays quiet when recent answers are still mostly right", () => {
    expect(shouldSuggestPause([true, true, true, true, true, true, false, true, false, true])).toBe(
      false,
    );
  });
});
