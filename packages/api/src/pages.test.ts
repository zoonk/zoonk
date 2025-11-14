import { describe, expect, it, vi } from "vitest";
import { isValidSlug } from "@zoonk/utils/validation";

// Mock the db module
vi.mock("@zoonk/db", () => ({
  checkSlugAvailability: vi.fn(),
  createPage: vi.fn(),
  deletePage: vi.fn(),
  findPageBySlug: vi.fn(),
  isPageAdmin: vi.fn(),
  updatePage: vi.fn(),
}));

describe("slug validation", () => {
  it("should validate valid slugs", () => {
    expect(isValidSlug("hello-world")).toBe(true);
    expect(isValidSlug("my-company")).toBe(true);
    expect(isValidSlug("company123")).toBe(true);
  });

  it("should reject invalid slugs", () => {
    expect(isValidSlug("Hello-World")).toBe(false); // Uppercase
    expect(isValidSlug("hello_world")).toBe(false); // Underscore
    expect(isValidSlug("hello.world")).toBe(false); // Dot
    expect(isValidSlug("-hello")).toBe(false); // Starts with hyphen
    expect(isValidSlug("hello-")).toBe(false); // Ends with hyphen
  });
});
