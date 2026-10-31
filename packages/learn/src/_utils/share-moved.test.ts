import { describe, expect, it } from "vitest";
import { hasShareMoved } from "./share-moved";

describe(hasShareMoved, () => {
  it("counts a change only when the whole percentage shown moves", () => {
    expect(hasShareMoved({ after: 0.33, before: 0.3 })).toBe(true);
    expect(hasShareMoved({ after: 0.24, before: 0.29 })).toBe(true);
    expect(hasShareMoved({ after: 0.324, before: 0.321 })).toBe(false);
    expect(hasShareMoved({ after: 0.5, before: 0.5 })).toBe(false);
  });
});
