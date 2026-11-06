import { describe, expect, it } from "vitest";
import { isUuid, lowercaseUuid } from "./uuid";

describe(isUuid, () => {
  it("returns true for valid UUID strings", () => {
    expect(isUuid("018f5c3e-a9f8-7cc9-88d4-31e5c7286210")).toBe(true);
    expect(isUuid("A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11")).toBe(true);
  });

  it("returns false for malformed values", () => {
    expect(isUuid("invalid-id")).toBe(false);
    expect(isUuid("999999")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  it("returns false for UUID strings padded with whitespace", () => {
    expect(isUuid(" 018f5c3e-a9f8-7cc9-88d4-31e5c7286210 ")).toBe(false);
  });
});

describe(lowercaseUuid, () => {
  it("reads a UUID lowercase and keeps any other value as sent", () => {
    expect(lowercaseUuid("A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11")).toBe(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    );

    expect(lowercaseUuid("phase:2")).toBe("phase:2");
    expect(lowercaseUuid("Biology")).toBe("Biology");
  });
});
