import { describe, expect, it } from "vitest";
import { pickLearnerTimeZone } from "./learner-time-zone";

describe(pickLearnerTimeZone, () => {
  it("takes the zone the browser wrote over the one Vercel guessed from the address", () => {
    expect(pickLearnerTimeZone({ cookie: "Pacific/Kiritimati", header: "Europe/Berlin" })).toBe(
      "Pacific/Kiritimati",
    );
  });

  it("uses the address's zone when the browser hasn't written one or wrote one that isn't a zone", () => {
    expect(pickLearnerTimeZone({ cookie: undefined, header: "Asia/Tokyo" })).toBe("Asia/Tokyo");

    expect(pickLearnerTimeZone({ cookie: "Mars/Olympus", header: "Asia/Tokyo" })).toBe(
      "Asia/Tokyo",
    );

    expect(pickLearnerTimeZone({ cookie: "", header: "Asia/Tokyo" })).toBe("Asia/Tokyo");
  });

  it("falls back to UTC when neither names a zone", () => {
    expect(pickLearnerTimeZone({ cookie: undefined, header: null })).toBe("UTC");
    expect(pickLearnerTimeZone({ cookie: "Mars/Olympus", header: "nowhere" })).toBe("UTC");
  });
});
