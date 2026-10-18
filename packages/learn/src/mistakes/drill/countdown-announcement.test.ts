import { describe, expect, it } from "vitest";
import { getAnnouncedSeconds } from "./countdown-announcement";

/** What the clock says as it ticks from `from` seconds left down to 1. */
function announceFrom(from: number): (number | null)[] {
  const said: (number | null)[] = [];

  Array.from({ length: from }, (_, index) => from - index).reduce<number | null>(
    (announced, secondsLeft) => {
      const next = getAnnouncedSeconds({ announced, secondsLeft });
      said.push(next);
      return next;
    },
    null,
  );

  return said;
}

describe(getAnnouncedSeconds, () => {
  it("says nothing before the last ten seconds, then the real seconds left at 10 and 5", () => {
    expect(announceFrom(13)).toStrictEqual([null, null, null, 10, 10, 10, 10, 10, 5, 5, 5, 5, 5]);
  });

  it("says the real seconds left for a question shorter than the warning", () => {
    expect(announceFrom(7)).toStrictEqual([7, 7, 5, 5, 5, 5, 5]);
  });
});
