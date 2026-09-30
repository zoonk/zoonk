import { describe, expect, it } from "vitest";
import { normalizeContentType } from "./upload";

describe(normalizeContentType, () => {
  it("drops parameters and case", () => {
    expect(normalizeContentType("Text/HTML; charset=UTF-8")).toBe("text/html");
  });
});
