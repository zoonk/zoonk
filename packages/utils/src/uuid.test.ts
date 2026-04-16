import { describe, expect, test } from "vitest";
import { isUuid } from "./uuid";

describe(isUuid, () => {
  test("returns true for valid UUID strings", () => {
    expect(isUuid("018f5c3e-a9f8-7cc9-88d4-31e5c7286210")).toBe(true);
    expect(isUuid("A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11")).toBe(true);
  });

  test("returns false for malformed values", () => {
    expect(isUuid("invalid-id")).toBe(false);
    expect(isUuid("999999")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});
