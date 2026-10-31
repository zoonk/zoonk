import { describe, expect, it } from "vitest";
import { getLessonLineTone } from "./line-tone";

describe(getLessonLineTone, () => {
  it("against a date, lessons left out are bad news and lessons added back are good news", () => {
    expect(getLessonLineTone({ byDate: true, kind: "removed" })).toBe("bad");
    expect(getLessonLineTone({ byDate: true, kind: "added" })).toBe("good");
  });

  it("without a date, fewer lessons are good news and more are never green", () => {
    expect(getLessonLineTone({ byDate: false, kind: "removed" })).toBe("good");
    expect(getLessonLineTone({ byDate: false, kind: "added" })).toBe("neutral");
  });
});
