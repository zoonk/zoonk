import { describe, expect, it } from "vitest";
import { parseRichInline } from "./rich-text-parser";

describe(parseRichInline, () => {
  it("keeps punctuation beside an inline code chip", () => {
    const segments = parseRichInline(
      "Write `Plants need water` . Then change `need` , not `water`.",
    );

    expect(segments.map(({ text }) => text).join("")).toBe(
      "Write Plants need water. Then change need, not water.",
    );
  });
});
