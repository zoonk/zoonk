import { describe, expect, it } from "vitest";
import { isValidSlug, toSlug } from "./validation";

describe("isValidSlug", () => {
  it("should return true for valid slugs", () => {
    expect(isValidSlug("hello")).toBe(true);
    expect(isValidSlug("hello-world")).toBe(true);
    expect(isValidSlug("hello123")).toBe(true);
    expect(isValidSlug("hello-world-123")).toBe(true);
    expect(isValidSlug("ab")).toBe(true);
  });

  it("should return false for invalid slugs", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("a")).toBe(false); // Too short
    expect(isValidSlug("Hello")).toBe(false); // Uppercase
    expect(isValidSlug("hello_world")).toBe(false); // Underscore
    expect(isValidSlug("hello.world")).toBe(false); // Dot
    expect(isValidSlug("-hello")).toBe(false); // Starts with hyphen
    expect(isValidSlug("hello-")).toBe(false); // Ends with hyphen
    expect(isValidSlug("hello world")).toBe(false); // Space
    expect(isValidSlug("hello@world")).toBe(false); // Special char
  });

  it("should return false for very long slugs", () => {
    const LongLength = 64;
    const longSlug = "a".repeat(LongLength);
    expect(isValidSlug(longSlug)).toBe(false);
  });
});

describe("toSlug", () => {
  it("should convert strings to valid slugs", () => {
    expect(toSlug("Hello World")).toBe("hello-world");
    expect(toSlug("Hello  World")).toBe("hello-world");
    expect(toSlug("  Hello World  ")).toBe("hello-world");
    expect(toSlug("Hello-World")).toBe("hello-world");
  });

  it("should remove accents", () => {
    expect(toSlug("Café")).toBe("cafe");
    expect(toSlug("Niño")).toBe("nino");
    expect(toSlug("São Paulo")).toBe("sao-paulo");
  });

  it("should remove invalid characters", () => {
    expect(toSlug("Hello@World!")).toBe("helloworld");
    expect(toSlug("Hello_World")).toBe("helloworld");
    expect(toSlug("Hello.World")).toBe("helloworld");
  });

  it("should handle multiple hyphens", () => {
    expect(toSlug("Hello---World")).toBe("hello-world");
  });

  it("should remove leading and trailing hyphens", () => {
    expect(toSlug("-Hello-")).toBe("hello");
    expect(toSlug("---Hello---")).toBe("hello");
  });
});
